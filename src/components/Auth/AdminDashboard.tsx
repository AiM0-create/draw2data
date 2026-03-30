import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { fetchExtractionLogs, type ExtractionLog } from '../../lib/analytics';

const COLORS = ['#3b82f6', '#ef4444', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0284c7'];

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [logs] = useState<ExtractionLog[]>(() => fetchExtractionLogs());
  const loading = false;

  const stats = useMemo(() => {
    if (!logs.length) return null;

    const totalExtractions = logs.length;
    const totalFeatures = logs.reduce((s, l) => s + l.featureCount, 0);
    const avgDuration = logs.reduce((s, l) => s + l.durationMs, 0) / logs.length;
    const uniqueUsers = new Set(logs.map((l) => l.userEmail).filter(Boolean)).size;

    // Dataset popularity
    const datasetCounts = new Map<string, number>();
    for (const l of logs) {
      for (const d of l.datasets) {
        datasetCounts.set(d, (datasetCounts.get(d) || 0) + 1);
      }
    }
    const datasetChart = [...datasetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // Source wins
    const sourceCounts = new Map<string, number>();
    for (const l of logs) {
      for (const [, src] of Object.entries(l.winners || {})) {
        if (src !== 'none') sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
      }
    }
    const sourceChart = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    // Daily extractions (last 14 days)
    const dailyCounts = new Map<string, number>();
    for (const l of logs) {
      const day = new Date(l.timestamp).toISOString().slice(0, 10);
      dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
    }
    const dailyChart = [...dailyCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, count]) => ({ date: date.slice(5), count }));

    // Top users
    const userCounts = new Map<string, number>();
    for (const l of logs) {
      const email = l.userEmail || 'anonymous';
      userCounts.set(email, (userCounts.get(email) || 0) + 1);
    }
    const topUsers = [...userCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));

    return { totalExtractions, totalFeatures, avgDuration, uniqueUsers, datasetChart, sourceChart, dailyChart, topUsers };
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-xs text-gray-500">Analytical insights for draw2data</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading analytics...</div>
        ) : !stats ? (
          <div className="p-12 text-center text-gray-400">
            No extraction data yet. Start extracting to see analytics.
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <KPI label="Total Extractions" value={stats.totalExtractions.toLocaleString()} />
              <KPI label="Total Features" value={stats.totalFeatures.toLocaleString()} />
              <KPI label="Avg Duration" value={`${(stats.avgDuration / 1000).toFixed(1)}s`} />
              <KPI label="Unique Users" value={stats.uniqueUsers.toString()} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Daily Extractions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Daily Extractions</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats.dailyChart}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Dataset Popularity */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Dataset Popularity</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.datasetChart} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Source Wins */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Source Win Rate</h3>
                {stats.sourceChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stats.sourceChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {stats.sourceChart.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-gray-400">No source data</p>
                )}
              </div>

              {/* Top Users */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Users</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {stats.topUsers.map((u, i) => (
                    <div key={u.email} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-gray-400 text-right">{i + 1}.</span>
                      <span className="flex-1 text-gray-700 truncate">{u.email}</span>
                      <span className="text-gray-400">{u.count} extractions</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
