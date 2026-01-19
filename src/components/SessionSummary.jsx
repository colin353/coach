export function SessionSummary({ summary }) {
  if (!summary) return null;

  let parsed;
  try {
    parsed = typeof summary === 'string' ? JSON.parse(summary) : summary;
  } catch (e) {
    return null;
  }

  const { insights, nextSteps, reading } = parsed;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 rounded-xl p-6 my-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📋</span>
        <h3 className="text-lg font-semibold text-white">Session Summary</h3>
      </div>

      {insights && insights.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-blue-400 uppercase tracking-wide mb-2">
            💡 Key Insights
          </h4>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-slate-500">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-green-400 uppercase tracking-wide mb-2">
            ✅ Next Steps
          </h4>
          <ul className="space-y-2">
            {nextSteps.map((step, i) => (
              <li key={i} className="text-slate-300 text-sm flex gap-2">
                <span className="text-slate-500">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {reading && reading.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-purple-400 uppercase tracking-wide mb-2">
            📚 Recommended Reading & Research
          </h4>
          <ul className="space-y-3">
            {reading.map((item, i) => (
              <li key={i} className="text-sm">
                <div className="text-slate-200 font-medium">{item.topic}</div>
                <div className="text-slate-400 text-xs mt-0.5">{item.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
