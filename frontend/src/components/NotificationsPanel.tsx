/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Notification } from '../types';
import { Bell, CheckCircle, Clock, AlertTriangle, ShieldAlert, Circle } from 'lucide-react';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

export default function NotificationsPanel({
  notifications,
  onMarkRead,
  onClearAll,
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: 'info' | 'success' | 'warning' | 'error') => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      default:
        return <Bell className="w-4 h-4 text-[#2563EB]" />;
    }
  };

  const getBgColor = (type: 'info' | 'success' | 'warning' | 'error') => {
    switch (type) {
      case 'success': return 'bg-emerald-50 border-emerald-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      case 'error': return 'bg-rose-50 border-rose-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  return (
    <div id="notifications-panel" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="w-5 h-5 text-[#0F172A]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full animate-pulse" />
            )}
          </div>
          <h3 className="font-sans font-bold text-slate-800 text-sm">Escrow Alerts Feed</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-[#2563EB] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">
              {unreadCount} New
            </span>
          )}
        </div>

        {notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            id={`notif-${notif.id}`}
            onClick={() => onMarkRead(notif.id)}
            className={`p-3.5 rounded-xl border flex gap-3 transition-all cursor-pointer relative items-start ${getBgColor(notif.type)} ${
              !notif.read ? 'hover:shadow-sm border-[#2563EB]/25 shadow-sm' : 'opacity-80'
            }`}
          >
            {/* Unread indicator point */}
            {!notif.read && (
              <Circle className="w-2 h-2 text-[#2563EB] fill-[#2563EB] absolute right-3.5 top-3.5" />
            )}

            {/* Notification Icon */}
            <div className="p-1 bg-white rounded-lg border border-slate-100/80 flex-shrink-0 mt-0.5 shadow-sm">
              {getIcon(notif.type)}
            </div>

            <div className="text-xs space-y-0.5 pr-2">
              <span className="font-bold text-slate-800 block">{notif.title}</span>
              <p className="text-slate-500 leading-relaxed">{notif.message}</p>
              <span className="text-[9px] text-slate-400 block pt-1 font-mono">{notif.timestamp}</span>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-10">
            <p className="text-xs text-slate-400 italic">No new system alerts or escrow changes logged.</p>
          </div>
        )}
      </div>
    </div>
  );
}
