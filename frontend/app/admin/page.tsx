'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { parseEther } from 'viem';

// ⚠️ 替换为你部署的 RandomnessProvider 地址 (从 npx hardhat deploy 的日志里找)
const RANDOMNESS_PROVIDER_ADDRESS = (process.env.NEXT_PUBLIC_RANDOMNESS_PROVIDER_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`; 

// 简化的 ABI，只包含我们需要的功能
const ABI = [
  {
    "inputs": [],
    "name": "requestRandomWords",
    "outputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "requester", "type": "address" }
    ],
    "name": "RequestSent",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function AdminPanel() {
  const { address, isConnected } = useAccount();
  const [logs, setLogs] = useState<string[]>([]);
  const { writeContract, isPending, isSuccess } = useWriteContract();

  // 1. 读取 Owner
  const { data: owner } = useReadContract({
    address: RANDOMNESS_PROVIDER_ADDRESS,
    abi: ABI,
    functionName: 'owner',
  });

  // 2. 监听 RequestSent 事件
  useWatchContractEvent({
    address: RANDOMNESS_PROVIDER_ADDRESS,
    abi: ABI,
    eventName: 'RequestSent',
    onLogs(newLogs) {
      newLogs.forEach((log) => {
        // @ts-ignore
        const requestId = log.args.requestId?.toString();
        // @ts-ignore
        const requester = log.args.requester;
        const message = `[${new Date().toLocaleTimeString()}] Request ID: ${requestId} | By: ${requester}`;
        setLogs((prev) => [message, ...prev]);
      });
    },
  });

  // 3. 手动请求随机数
  const handleRequest = () => {
    writeContract({
      address: RANDOMNESS_PROVIDER_ADDRESS,
      abi: ABI,
      functionName: 'requestRandomWords',
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🎲 Randomness Provider Admin</h1>
      
      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-100 p-6 rounded-xl">
          <h2 className="text-gray-500 text-sm uppercase tracking-wide">Contract Address</h2>
          <p className="font-mono text-lg break-all">{RANDOMNESS_PROVIDER_ADDRESS}</p>
        </div>
        <div className="bg-gray-100 p-6 rounded-xl">
          <h2 className="text-gray-500 text-sm uppercase tracking-wide">Owner / Admin</h2>
          <p className="font-mono text-lg break-all">{owner ? String(owner) : "Loading..."}</p>
        </div>
      </div>

      {/* 操作区 */}
      <div className="mb-8">
        <button
          onClick={handleRequest}
          disabled={!isConnected || isPending}
          className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
            isPending ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isPending ? 'Requesting...' : '⚡ Trigger Randomness Request'}
        </button>
        {isSuccess && <p className="text-green-600 mt-2">Request Transaction Sent!</p>}
      </div>

      {/* 日志区 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-700">Live Event Logs (RequestSent)</h3>
        </div>
        <div className="h-64 overflow-y-auto p-6 bg-black text-green-400 font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">Waiting for events...</p>
          ) : (
            logs.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}