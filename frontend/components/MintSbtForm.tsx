"use client";

import React, { useState } from "react";
import { Award, Loader2, Sparkles, ExternalLink, ShieldCheck } from "lucide-react";

interface MintSbtFormProps {
  file: File;
  fileHash: string;
  recipientName: string;
  institutionName: string;
  issueDateStr: string; // YYYY-MM-DD
  trustScore: number;
  verificationLink: string;
  contractAddress: string;
  onSuccess: (txHash: string) => void;
}

export function MintSbtForm({
  file,
  fileHash,
  recipientName,
  institutionName,
  issueDateStr,
  trustScore,
  verificationLink,
  contractAddress,
  onSuccess,
}: MintSbtFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setErrorMsg(null);
    setIsSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recipient_name", recipientName || "Unknown");
      formData.append("institution_name", institutionName || "Unknown");
      formData.append("issue_date", issueDateStr || "");
      formData.append("trust_score", String(trustScore));
      formData.append("verification_link", verificationLink || "");
      formData.append("recipient_wallet", ""); // blank registers to hot wallet address

      const response = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to register on-chain.");
      }

      const result = await response.json();
      
      if (result.status === 1) {
        setHash(result.txHash);
        setBlockNumber(result.blockNumber);
        setIsSuccess(true);
        onSuccess(result.txHash);
      } else {
        throw new Error("Transaction reverted on-chain.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit transaction.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-[#121020]/40 rounded-2xl p-6 border border-[#231f42] text-left mt-8">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="h-5 w-5 text-brand-pink" />
        <h3 className="font-display text-lg font-bold text-white">
          On-Chain Security Registration
        </h3>
      </div>
      <p className="text-sm text-[#a5a2c2] mb-6">
        Click below to register this certificate's verification footprint permanently on the Monad ledger. This operation runs gas-free for the user.
      </p>

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Extracted Certificate Info (Read-Only Summary) */}
        <div className="bg-[#090812] border border-[#231f42] rounded-xl p-4 text-sm space-y-2">
          <p className="text-xs font-semibold text-[#8c8aab] uppercase tracking-wider border-b border-[#231f42] pb-2 mb-2">
            Verification Records Summary
          </p>
          <div className="flex justify-between">
            <span className="text-[#8c8aab]">Recipient:</span>
            <span className="font-semibold text-white">{recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8c8aab]">Institution:</span>
            <span className="font-semibold text-white">{institutionName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8c8aab]">Issue Date:</span>
            <span className="text-white">{issueDateStr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8c8aab]">AI Trust Score:</span>
            <span className="font-bold text-[#00ffcc]">{trustScore}%</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || isSuccess}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-purple hover:bg-brand-purple/90 hover:shadow-lg hover:shadow-brand-purple/20 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Securing on Monad ledger (parallelized consensus)...
            </>
          ) : isSuccess ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Successfully Secured on Monad!
            </>
          ) : (
            <>
              <Award className="h-4 w-4" />
              Register on Monad Ledger
            </>
          )}
        </button>
      </form>

      {/* Transaction status details */}
      {hash && (
        <div className="mt-4 bg-[#090812] border border-[#231f42] rounded-xl p-4 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[#8c8aab]">Transaction Hash:</span>
            <span className="font-mono text-white text-[11px] truncate max-w-xs">{hash}</span>
          </div>
          {blockNumber && (
            <div className="flex justify-between pt-1">
              <span className="text-[#8c8aab]">Block Number:</span>
              <span className="font-mono text-white text-[11px]">{blockNumber}</span>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <span className="text-[#8c8aab]">Status:</span>
            <span className="font-semibold text-emerald-400">
              Confirmed (Sub-second Finality)
            </span>
          </div>
          <div className="pt-2">
            <a
              href={`https://testnet.monadscan.com/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-brand-purple hover:underline gap-1 font-semibold"
            >
              View on Monadscan Explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-brand-pink text-xs rounded-xl font-mono overflow-x-auto">
          Error: {errorMsg}
        </div>
      )}
    </div>
  );
}
