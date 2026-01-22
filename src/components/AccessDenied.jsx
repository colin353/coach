export function AccessDenied({ email, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-md w-full text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        
        {email && (
          <p className="text-slate-400 mb-4">
            Signed in as: <span className="text-white font-medium">{email}</span>
          </p>
        )}
        
        <p className="text-slate-400 mb-6">
          Your account is not authorized to access this application.
        </p>
        
        <div className="bg-slate-700 rounded-lg p-4 mb-6">
          <p className="text-slate-300 text-sm">
            To request access, please email:
          </p>
          <a 
            href="mailto:colin.merkel@gmail.com?subject=AI%20Career%20Coach%20Access%20Request"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            colin.merkel@gmail.com
          </a>
        </div>
        
        <button
          onClick={onLogout}
          className="text-slate-400 hover:text-white transition-colors text-sm"
        >
          Sign out and try a different account
        </button>
      </div>
    </div>
  );
}
