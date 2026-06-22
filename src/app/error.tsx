"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <h2 className="text-xl font-semibold mb-2">出错了</h2>
      <p className="text-muted-foreground mb-4">{error.message || "发生了意外错误"}</p>
      {error.digest && <p className="text-xs text-muted-foreground mb-4">错误 ID: {error.digest}</p>}
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">重试</button>
    </div>
  );
}