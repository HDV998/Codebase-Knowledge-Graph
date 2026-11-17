'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FolderGit2, Check, Loader2, Sparkles, Database } from 'lucide-react';
import { fetchGraphQL } from '../lib/graphqlClient';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestSuccess: (repoId: string) => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onIngestSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customRepoName, setCustomRepoName] = useState('my-custom-service');
  const [filePath, setFilePath] = useState('src/services/CustomPaymentService.ts');
  const [fileContent, setFileContent] = useState(`
export class CustomPaymentService {
  public async handleStripeWebhook(event: any): Promise<void> {
    if (event.type === 'payment_intent.succeeded') {
      await this.fulfillOrder(event.data.object.id);
    }
  }

  private async fulfillOrder(orderId: string): Promise<boolean> {
    return true;
  }
}
  `);

  if (!isOpen) return null;

  const handleSeedPreset = async (presetId: string) => {
    setError(null);
    setLoading(true);
    try {
      const mutation = `
        mutation IngestPreset($id: String!) {
          ingestSampleRepo(sampleId: $id) {
            success
            message
            repoId
            nodesCount
            edgesCount
          }
        }
      `;
      const data = await fetchGraphQL(mutation, { id: presetId });
      onIngestSuccess(data.ingestSampleRepo.repoId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this sample.');
    } finally {
      setLoading(false);
    }
  };

  const handleIngestCustom = async () => {
    if (!customRepoName.trim() || !filePath.trim() || !fileContent.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const mutation = `
        mutation IngestCustom($repoId: String!, $files: [FileInput!]!) {
          ingestCustomCodebase(repoId: $repoId, files: $files) {
            success
            message
            repoId
            nodesCount
            edgesCount
          }
        }
      `;
      const data = await fetchGraphQL(mutation, {
        repoId: customRepoName,
        files: [{ path: filePath, content: fileContent }]
      });
      onIngestSuccess(data.ingestCustomCodebase.repoId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not ingest this file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-label="Ingest code" className="bg-surface border border-border w-full max-w-xl max-h-[90dvh] rounded-2xl shadow-2xl overflow-auto flex flex-col">
        {error && <p role="alert" className="p-4 text-rose-300">{error}</p>}
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-highlight">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Ingest Codebase Knowledge Graph</h3>
              <p className="text-xs text-slate-400">Extract symbols and relationships from source files</p>
            </div>
          </div>
          <button
            aria-label="Close ingestion dialog"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border bg-[#090d16] text-xs">
          <button
            onClick={() => setActiveTab('preset')}
            className={`flex-1 py-2.5 font-semibold text-center transition-colors ${
              activeTab === 'preset'
                ? 'text-sky-400 border-b-2 border-sky-500 bg-surface/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pre-built Microservices
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-2.5 font-semibold text-center transition-colors ${
              activeTab === 'custom'
                ? 'text-sky-400 border-b-2 border-sky-500 bg-surface/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom Code Ingest
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'preset' ? (
            <div className="space-y-3">
              <div 
                onClick={() => handleSeedPreset('ecommerce-payment-platform')}
                className="p-4 rounded-xl bg-surface-highlight/60 hover:bg-surface-highlight border border-border hover:border-sky-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white group-hover:text-sky-300">
                    E-Commerce & Payment Platform
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    13 Files • TS / Jest
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Full checkout call graph: OrderService ➔ PaymentProcessor ➔ StripeGateway ➔ InventoryService & Test suites.
                </p>
              </div>

              <div 
                onClick={() => handleSeedPreset('auth-identity-rbac-service')}
                className="p-4 rounded-xl bg-surface-highlight/60 hover:bg-surface-highlight border border-border hover:border-sky-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white group-hover:text-sky-300">
                    Auth & Identity RBAC Service
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    9 Files • Python / Pytest
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Authentication controller with JWT TokenService, bcrypt PasswordHasher, audit logger, and unit tests.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Repository Name</label>
                <input
                  type="text"
                  value={customRepoName}
                  onChange={(e) => setCustomRepoName(e.target.value)}
                  className="w-full bg-[#090d16] text-xs text-white border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">File Path</label>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="w-full bg-[#090d16] text-xs text-white border border-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Source Code</label>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  rows={6}
                  className="w-full bg-[#090d16] text-xs text-slate-200 border border-border rounded-lg p-3 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                onClick={handleIngestCustom}
                disabled={loading}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>Parse & Ingest into Graph</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
