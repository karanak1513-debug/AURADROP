'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  MessageSquare,
  Activity,
  History,
} from 'lucide-react';
import { TacticalMessage, AuditEvent, Peer } from '@/types/vault';
import { encryptText, decryptText } from '@/lib/crypto';
import { sound } from '@/lib/sound';

interface TacticalSignalStreamProps {
  podId: string;
  cryptoKey: CryptoKey;
  currentPeer: Peer;
  auditLog: AuditEvent[];
  incomingMessages: TacticalMessage[];
  onSendMessage: (msg: TacticalMessage) => void;
}

interface DecryptedChatMessage {
  id: string;
  timestamp: number;
  senderId: string;
  senderCodename: string;
  senderColor: string;
  text: string;
}

export function TacticalSignalStream({
  podId,
  cryptoKey,
  currentPeer,
  auditLog,
  incomingMessages,
  onSendMessage,
}: TacticalSignalStreamProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'audit'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [decryptedChatList, setDecryptedChatList] = useState<DecryptedChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Decrypt incoming tactical messages
  useEffect(() => {
    const decryptNewMessages = async () => {
      for (const msg of incomingMessages) {
        if (!processedMessageIds.current.has(msg.id)) {
          processedMessageIds.current.add(msg.id);
          try {
            const text = await decryptText(msg.encryptedText, msg.iv, cryptoKey);
            setDecryptedChatList((prev) => [
              ...prev,
              {
                id: msg.id,
                timestamp: msg.timestamp,
                senderId: msg.senderId,
                senderCodename: msg.senderCodename,
                senderColor: msg.senderColor,
                text,
              },
            ]);

            if (msg.senderId !== currentPeer.id) {
              sound.playClick();
            }
          } catch (err) {
            console.error('Failed to decrypt chat message:', err);
          }
        }
      }
    };

    decryptNewMessages();
  }, [incomingMessages, cryptoKey, currentPeer.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [decryptedChatList, auditLog, activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const plainText = chatInput.trim();
    setChatInput('');

    try {
      const { ciphertext, iv } = await encryptText(plainText, cryptoKey);
      const msg: TacticalMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        senderId: currentPeer.id,
        senderCodename: currentPeer.codename,
        senderColor: currentPeer.color,
        encryptedText: ciphertext,
        iv,
      };

      onSendMessage(msg);
      sound.playClick();
    } catch (err) {
      console.error('Error encrypting message:', err);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toTimeString().substring(0, 5);
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden flex flex-col h-[580px] shadow-premium border border-white/95">
      {/* Tab Switcher Header */}
      <div className="bg-white/60 backdrop-blur-md border-b border-slate-200/60 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('chat');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer tactile-btn ${
              activeTab === 'chat'
                ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>Private Chat</span>
            {decryptedChatList.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('audit');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer tactile-btn ${
              activeTab === 'audit'
                ? 'bg-cyan-50 border border-cyan-200 text-cyan-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-cyan-600" />
            <span>Activity Log</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          {activeTab === 'chat' ? 'Temporary' : 'Live'}
        </span>
      </div>

      {/* Stream Area */}
      <div
        ref={chatScrollRef}
        className="flex-1 p-3.5 overflow-y-auto bg-slate-50/30 text-xs space-y-3"
      >
        {activeTab === 'chat' ? (
          decryptedChatList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <MessageSquare className="w-8 h-8 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">Private Live Chat</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs font-normal">
                Messages are private, encrypted, and only visible right now. Nothing is ever saved.
              </p>
            </div>
          ) : (
            decryptedChatList.map((msg) => {
              const isMe = msg.senderId === currentPeer.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                    <span
                      className="font-bold"
                      style={{ color: msg.senderColor || '#6366F1' }}
                    >
                      {msg.senderCodename} {isMe ? '(You)' : ''}
                    </span>
                    <span>•</span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-normal shadow-xs ${
                      isMe
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-medium'
                        : 'bg-white/90 border border-slate-200/80 text-slate-900'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Audit Log */
          auditLog.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
              <Activity className="w-8 h-8 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">No activity yet</p>
              <p className="text-xs text-slate-400 mt-1">Actions like uploads and downloads appear here.</p>
            </div>
          ) : (
            auditLog.map((event) => (
              <div
                key={event.id}
                className="p-2.5 rounded-2xl bg-white/80 border border-slate-200/80 text-xs flex items-start gap-2 shadow-xs"
              >
                <span className="text-[10px] text-slate-400 shrink-0 mt-0.5 font-mono">
                  [{formatTime(event.timestamp)}]
                </span>
                <div className="min-w-0">
                  <span className="text-slate-700 font-medium">{event.message}</span>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Chat Input Bar */}
      {activeTab === 'chat' && (
        <form
          onSubmit={handleSend}
          className="p-3 bg-white/70 backdrop-blur-md border-t border-slate-200/60 flex items-center gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl px-3.5 py-2 text-xs text-slate-900 outline-none transition-all shadow-xs"
          />
          <button
            type="submit"
            className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-95 text-white font-bold transition-all shadow-md shadow-indigo-500/20 tactile-btn cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}
