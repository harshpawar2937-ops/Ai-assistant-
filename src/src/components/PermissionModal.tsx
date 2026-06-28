import React from 'react';
import { motion } from 'motion/react';
import { MicOff, WifiOff, AlertTriangle } from 'lucide-react';

interface Props {
  errorType: 'microphone' | 'connection';
  onClose: () => void;
}

export default function PermissionModal({ errorType, onClose }: Props) {
  const isConnectionError = errorType === 'connection';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          {isConnectionError ? (
            <WifiOff size={32} className="text-red-400" />
          ) : (
            <MicOff size={32} className="text-red-400" />
          )}
        </div>
        
        <h2 className="text-2xl font-serif font-medium text-white mb-3">
          {isConnectionError ? 'Server Connection Failed' : 'Microphone Blocked'}
        </h2>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          {isConnectionError 
            ? 'Unable to establish a persistent WebSocket stream to Sanjana.' 
            : 'Your browser has blocked microphone access for this site. Sanjana cannot hear you until you allow it.'
          }
        </p>
        
        {isConnectionError ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left w-full mb-8">
            <p className="text-sm text-white/80 font-medium mb-2 flex items-center gap-1.5 text-orange-400">
              <AlertTriangle size={14} /> Vercel Deployment Note:
            </p>
            <p className="text-xs text-white/60 leading-relaxed space-y-2">
              Vercel Serverless Functions <strong>do not support</strong> persistent, long-lived stateful WebSocket servers.
            </p>
            <div className="mt-3 text-xs text-white/60">
              <strong>How to fix:</strong>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>Use <strong>Cloud Run</strong> (Google Cloud's container platform, which is what AI Studio uses by default).</li>
                <li>Or host on Railway, Render, or Heroku which fully support WebSockets.</li>
                <li><strong>Workaround:</strong> You can still use the <strong>text-chat box</strong> (Keyboard icon ⌨️) on Vercel because it uses standard HTTP POST requests!</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left w-full mb-8">
            <p className="text-sm text-white/80 font-medium mb-2">How to fix this in Chrome:</p>
            <ol className="text-xs text-white/60 list-decimal pl-4 space-y-2">
              <li><strong>Best Method:</strong> Open this app directly in a <strong>New Tab</strong> so Chrome can safely ask for microphone permission.</li>
              <li>Click the <strong>Settings icon (⚙️)</strong> or <strong>Lock icon (🔒)</strong> on the left side of the address bar.</li>
              <li>Toggle the <strong>Microphone</strong> permission to <strong>Allow</strong>.</li>
              <li>Reload the page to start talking to Sanjana!</li>
            </ol>
          </div>
        )}
        
        <div className="flex flex-col w-full gap-3">
          {!isConnectionError && (
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-center"
            >
              Open in New Tab 🚀
            </a>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Refresh Page
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/5 text-white/70 font-medium rounded-xl hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
