import React, { useEffect, useState } from 'react';
import { CloudOff, Wifi } from 'lucide-react';
import { loadPendingLearningEvents } from '../utils/learningEventEngine';
import { getNetworkState, subscribeToNetworkState } from '../utils/networkState';

export default function NetworkStatus() {
  const [state, setState] = useState(getNetworkState);

  useEffect(() => subscribeToNetworkState(setState), []);
  if (state === 'online') return null;

  const pendingCount = loadPendingLearningEvents().length;
  const limited = state === 'limited';
  return (
    <div className={`network-status ${limited ? 'is-limited' : 'is-offline'}`} role="status">
      {limited ? <Wifi size={17} aria-hidden="true" /> : <CloudOff size={17} aria-hidden="true" />}
      <span>
        {limited ? 'Kết nối chưa ổn định.' : 'Bạn đang offline.'}
        {' '}Tiến độ vẫn được lưu trên thiết bị{pendingCount ? ` (${pendingCount} mục đang chờ đồng bộ).` : '.'}
      </span>
    </div>
  );
}
