import { rbTopics } from "@/features/sheet/data/rb-patterns";

export function PatternCatalog() {
  const total = rbTopics.flatMap((topic) => topic.patterns).reduce((sum, pattern) => sum + pattern.questionCount, 0);
  return <main className="shell"><nav className="nav"><a className="brand" href="/"><span className="mark">DS</span>Danish SDE Sheet</a><span>{total} RB-pattern practice slots</span></nav><section className="section"><div className="eyebrow">RB pattern taxonomy</div><h1>Pattern Wise Sheet</h1><p>Master data structures and algorithms topic by topic.</p></section><section className="catalog">{rbTopics.map((topic) => <article className="catalog-topic" key={topic.name}><header><h2>{topic.name}</h2><p>{topic.description}</p></header>{topic.patterns.map((pattern) => <div className="catalog-pattern" key={pattern.name}><div><h3>{pattern.name}</h3><p>{pattern.description}</p></div><b>0/{pattern.questionCount}</b></div>)}</article>)}</section></main>;
}
