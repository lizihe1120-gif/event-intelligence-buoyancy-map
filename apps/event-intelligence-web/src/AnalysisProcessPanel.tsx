import { useEffect } from "react";

import { analysisProcessSteps, analysisRun, processNotices } from "./analysisRunAdapter";

export function AnalysisProcessPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="process-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="process-panel" role="dialog" aria-modal="true" aria-labelledby="process-panel-title">
        <header className="process-panel__header">
          <div>
            <p>INTELLIGENCE PROVENANCE</p>
            <h2 id="process-panel-title">本次情报如何生成</h2>
          </div>
          <button type="button" className="process-panel__close" onClick={onClose} aria-label="关闭分析过程">×</button>
        </header>
        <div className="process-run-summary">
          <span className="process-run-summary__status">{analysisRun.validationPassed ? "VALIDATED" : "BLOCKED"}</span>
          <div><strong>{analysisRun.id}</strong><small>{analysisRun.promptVersion} · model {analysisRun.modelName}</small></div>
          <time>{analysisRun.completedAt.replace("T", " ")}</time>
        </div>
        <ol className="process-steps">
          {analysisProcessSteps.map((step) => (
            <li key={step.index}>
              <span className="process-step__index">{String(step.index).padStart(2, "0")}</span>
              <div className="process-step__body">
                <div className="process-step__title">
                  <h3>{step.title}</h3>
                  <span className={step.status === "完成" ? "is-complete" : "is-failed"}>{step.status}</span>
                </div>
                <div className="process-step__metrics"><strong>{step.metric}</strong><span>{step.duration}</span></div>
                <p>{step.summary}</p>
                <dl><div><dt>结果</dt><dd>{step.result}</dd></div><div><dt>限制</dt><dd>{step.limitation}</dd></div></dl>
              </div>
            </li>
          ))}
        </ol>
        <footer className="process-panel__notices">
          {processNotices.map((notice) => <p key={notice}><span aria-hidden="true">◆</span>{notice}</p>)}
        </footer>
      </aside>
    </div>
  );
}
