/**
 * Author: Chris M. Pérez
 * License: MIT
 */

import Fuse from "fuse.js";

export interface RelationMatchResult {
  modelName: string;
  confidence: number;
  strategy:
  | "exact"
  | "learnedPattern"
  | "learnedSelfRelation"
  | "fstPattern"
  | "morphological"
  | "fuzzy";
}

export class PureFSTRelationMatcher {
  public readonly modelNames: readonly string[];

  // Pre-computed data
  private readonly lowerToOriginal: ReadonlyMap<string, string>;
  private readonly modelTokens: ReadonlyMap<string, readonly string[]>;
  private readonly modelTokenSet: ReadonlyMap<string, ReadonlySet<string>>;

  // Learned from @relation
  private readonly fieldToModel = new Map<string, string>();
  private readonly relationGraph = new Map<string, Set<string>>();

  // Statistics
  private readonly tokenFreq = new Map<string, number>();
  private readonly transitions = new Map<string, Map<string, number>>();

  private readonly fuse: Fuse<string>;

  constructor(modelNames: readonly string[]) {
    this.modelNames = modelNames;

    const lowerMap = new Map<string, string>();
    const tokensMap = new Map<string, readonly string[]>();
    const setMap = new Map<string, ReadonlySet<string>>();

    for (const m of modelNames) {
      const low = m.toLowerCase();
      lowerMap.set(low, m);

      const tokens = this.tokenize(m);
      tokensMap.set(m, tokens);
      setMap.set(m, new Set(tokens));
    }

    this.lowerToOriginal = lowerMap;
    this.modelTokens = tokensMap;
    this.modelTokenSet = setMap;

    this.fuse = new Fuse(modelNames, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    this.learnStatistics(tokensMap);
  }

  public getTargetModelFromGraph(relationName: string, currentModelName: string): string | null {
    const set = this.relationGraph.get(relationName);
    if (!set?.size) return null;

    if (set.size === 1) {
      return set.keys().next().value as string;
    }

    for (const model of set) {
      if (model !== currentModelName) return model;
    }
    return null;
  }

  public learnGlobalPatterns(
    objects: readonly {
      name: string;
      fields: readonly { name: string; documentation?: string }[];
    }[]
  ): void {
    for (const obj of objects) {
      for (const f of obj.fields) {
        const doc = f.documentation ?? "";
        const match = doc.match(/@relation\((?:"([^"]+)"|name:\s*"([^"]+)")/);
        const relationName = match?.[1] ?? match?.[2];
        if (!relationName) continue;

        if (!this.relationGraph.has(relationName)) {
          this.relationGraph.set(relationName, new Set());
        }
        this.relationGraph.get(relationName)!.add(obj.name);

        const target = this.extractModelFromRelationName(relationName);
        if (target) {
          this.fieldToModel.set(f.name, target);

          const ids = doc.match(/fields:\s*\[([^\]]+)\]/)?.[1];
          if (ids) {
            for (const id of ids.split(",").map(s => s.trim()).filter(Boolean)) {
              this.fieldToModel.set(id, target);
              const base = id.replace(/(Id|ID|_id|_ID)$/i, "");
              if (base !== id) this.fieldToModel.set(base, target);
            }
          }
        }
      }
    }
  }

  public match(fieldName: string, currentModel: string): RelationMatchResult | null {
    // 1. Learned pattern
    const learned = this.fieldToModel.get(fieldName);
    if (learned) return { modelName: learned, confidence: 0.95, strategy: "learnedPattern" };

    // 2. Exact
    const exact = this.lowerToOriginal.get(fieldName.toLowerCase());
    if (exact) return { modelName: exact, confidence: 1.0, strategy: "exact" };

    const fieldLow = fieldName.toLowerCase();
    const fieldTokens = this.tokenize(fieldLow);

    // 3. Self-relation
    const curTokens = this.modelTokens.get(currentModel)!;
    const curSet = this.modelTokenSet.get(currentModel)!;

    let common = 0;
    for (const t of fieldTokens) if (curSet.has(t)) common++;

    if (common > 0 && common / (fieldTokens.length + curTokens.length - common) > 0.33) {
      const conf = this.selfConfidence(fieldTokens, curTokens);
      return { modelName: currentModel, confidence: conf, strategy: "learnedSelfRelation" };
    }

    // 4. FST
    const fst = this.fastFstMatch(fieldTokens);
    if (fst) return fst;

    // 5. Morphological
    const clean = fieldLow.replace(/(id|ids|ref|refs|key|keys|fk)$/i, "").trim();
    if (clean) {
      const morph = this.lowerToOriginal.get(clean.charAt(0).toUpperCase() + clean.slice(1));
      if (morph) return { modelName: morph, confidence: 0.86, strategy: "morphological" };
    }

    // 6. Fuzzy
    const results = this.fuse.search(fieldName, { limit: 3 });
    for (const r of results) {
      const conf = 1 - (r.score ?? 1);
      if (conf >= 0.6) return { modelName: r.item, confidence: conf, strategy: "fuzzy" };
    }

    return null;
  }

  public suggestBackRelation(forwardField: string, forwardModel: string): string | null {
    const fieldTokens = this.tokenize(forwardField.toLowerCase());
    const modelTokens = this.modelTokens.get(forwardModel)!;

    if (fieldTokens.length && modelTokens.some(t => fieldTokens[0] === t || fieldTokens[0] === t + "s")) {
      return null;
    }

    const descriptor = fieldTokens.filter(t => !modelTokens.includes(t));
    const plural = this.plural(modelTokens.join(""));

    return descriptor.length
      ? plural + descriptor.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("")
      : plural;
  }

  private tokenize(s: string): readonly string[] {
    return s
      .split(/[^a-z0-9]+|(?<=[a-z])(?=[A-Z])/)
      .filter(t => t.length > 0 && !/^\d+$/.test(t));
  }

  private learnStatistics(map: ReadonlyMap<string, readonly string[]>): void {
    const freq = this.tokenFreq;
    const trans = this.transitions;

    for (const tokens of map.values()) {
      for (let i = 0; i < tokens.length; i++) {
        const cur = tokens[i];
        if (!cur) continue;

        freq.set(cur, (freq.get(cur) ?? 0) + 1);

        if (i + 1 < tokens.length) {
          const next = tokens[i + 1];
          if (!next) continue;

          let inner = trans.get(cur);
          if (!inner) trans.set(cur, inner = new Map());
          inner.set(next, (inner.get(next) ?? 0) + 1);
        }
      }
    }

    // Normalise to probabilities
    for (const [from, inner] of trans) {
      const sum = [...inner.values()].reduce((a, b) => a + b, 0);
      if (sum === 0) continue;
      const norm = new Map<string, number>();
      for (const [to, cnt] of inner) norm.set(to, cnt / sum);
      trans.set(from, norm);
    }
  }

  private extractModelFromRelationName(rel: string): string | null {
    for (const m of this.modelNames) if (rel.startsWith(m)) return m;
    return null;
  }

  private selfConfidence(field: readonly string[], model: readonly string[]): number {
    let common = 0;
    const set = this.modelTokenSet.get(model.join("")) ?? new Set(model);
    for (const t of field) if (set.has(t)) common++;

    const jaccard = common / (field.length + model.length - common || 1);

    let pos = 0;
    const len = Math.min(field.length, model.length);
    for (let i = 0; i < len; i++) if (field[i] === model[i]) pos++;

    return Math.min(0.94, jaccard * 0.65 + (len ? pos / len : 0) * 0.35);
  }

  private fastFstMatch(fieldTokens: readonly string[]): RelationMatchResult | null {
    let bestModel = "";
    let bestScore = 0.49;

    for (const model of this.modelNames) {
      const mt = this.modelTokens.get(model)!;
      let score = 0;
      const max = Math.max(fieldTokens.length, mt.length);

      for (let i = 0; i < fieldTokens.length && i < mt.length; i++) {
        const f = fieldTokens[i];
        const m = mt[i];
        if (!f || !m) continue;

        if (f === m) score += 2.0;
        else if (this.similar(f, m)) score += 1.3;

        if (i + 1 < fieldTokens.length && i + 1 < mt.length) {
          const nextToken = mt[i + 1];
          if (nextToken) {
            score += (this.transitions.get(f)?.get(nextToken) ?? 0) * 0.7;
          }
        }
      }

      const lenDiff = Math.abs(fieldTokens.length - mt.length) / max;
      score = (score / max) * (1 - lenDiff * 0.5);

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }

    if (bestScore >= 0.5) {
      return { modelName: bestModel, confidence: Math.min(0.94, bestScore), strategy: "fstPattern" };
    }
    return null;
  }

  private similar(a: string, b: string): boolean {
    if (a === b) return true;
    const min = Math.min(a.length, b.length);
    let pre = 0, suf = 0;
    while (pre < min && a[pre] === b[pre]) pre++;
    while (suf < min && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    return (pre + suf) >= min * 1.2;
  }

  private plural(word: string): string {
    if (/[sxz]$|ch$|sh$/.test(word)) return word + "es";
    if (word.endsWith("y") && !/[aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
    return word + "s";
  }
}

export const matchRelationModelName = (fieldName: string, modelNames: readonly string[], currentModel: string) => {
  return new PureFSTRelationMatcher(modelNames).match(fieldName, currentModel)?.modelName ?? null;
};

export const suggestBackRelationName = (forwardField: string, forwardModel: string, modelNames: readonly string[] = []) => {
  return new PureFSTRelationMatcher(modelNames).suggestBackRelation(forwardField, forwardModel);
};