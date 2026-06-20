"use client";

import React from "react";
import { ShieldAlert, ShieldCheck, ExternalLink, Calendar, User, Building, Award, Wallet } from "lucide-react";

interface OnChainRecord {
  tokenId: number;
  recipientName: string;
  institutionName: string;
  issueDate: number;
  trustScore: number;
  verificationLink: string;
  isValid: boolean;
  recipientWallet: string;
  fileHash: string;
}

interface OnChainVerifiedCardProps {
  record: OnChainRecord;
  contractAddress: string;
}

export function OnChainVerifiedCard({ record, contractAddress }: OnChainVerifiedCardProps) {
  const formattedDate = new Date(record.issueDate * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`glow-card ${record.isValid ? 'glow-card-active animate-glow' : 'border-red-500/50'} w-full max-w-xl mx-auto bg-[#121020]/90 rounded-2xl p-6 border border-[#836efd]/30 text-left`}>
      <div className="flex items-center justify-between border-b border-[#231f42] pb-4 mb-4">
        <div className="flex items-center space-x-3">
          {record.isValid ? (
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
          ) : (
            <div className="p-2 bg-red-500/10 rounded-lg text-brand-pink">
              <ShieldAlert className="h-6 w-6" />
            </div>
          )}
          <div>
            <h3 className="font-display text-lg font-bold text-white leading-none">
              {record.isValid ? "ON-CHAIN VERIFIED" : "REVOKED CERTIFICATE"}
            </h3>
            <p className="text-xs text-[#a5a2c2] mt-1">Monad Testnet SBT Secure</p>
          </div>
        </div>
        <span className="text-xs font-bold text-brand-purple bg-brand-purple/10 px-2.5 py-1 rounded-full">
          Token ID #{record.tokenId}
        </span>
      </div>

      <div className="space-y-4">
        {/* Recipient */}
        <div className="flex items-start space-x-3">
          <User className="h-5 w-5 text-[#836efd] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">Recipient Name</p>
            <p className="text-sm font-semibold text-white mt-0.5">{record.recipientName}</p>
          </div>
        </div>

        {/* Institution */}
        <div className="flex items-start space-x-3">
          <Building className="h-5 w-5 text-[#836efd] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">Issuing Institution</p>
            <p className="text-sm font-semibold text-white mt-0.5">{record.institutionName}</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-[#836efd] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">Issue Date</p>
            <p className="text-sm text-white mt-0.5">{formattedDate}</p>
          </div>
        </div>

        {/* Recipient Wallet */}
        <div className="flex items-start space-x-3">
          <Wallet className="h-5 w-5 text-[#836efd] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">Recipient Wallet</p>
            <p className="text-xs text-[#a5a2c2] font-mono mt-1 break-all bg-[#090812] px-2 py-1 rounded border border-[#231f42]">
              {record.recipientWallet}
            </p>
          </div>
        </div>

        {/* Trust Score & Verification Link */}
        <div className="grid grid-cols-2 gap-4 border-t border-[#231f42] pt-4 mt-2">
          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">AI Trust Score</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <Award className="h-5 w-5 text-[#00ffcc]" />
              <span className="text-lg font-bold text-[#00ffcc]">{record.trustScore}%</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-[#8c8aab] uppercase tracking-wider font-semibold">Verification Link</p>
            {record.verificationLink ? (
              <a
                href={record.verificationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-brand-purple hover:underline mt-2.5 font-semibold gap-1"
              >
                Official Page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-xs text-[#a5a2c2] inline-block mt-2">N/A</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#231f42] pt-4 mt-6 flex justify-between text-xs">
        <span className="text-[#8c8aab]">Document Hash: <code className="text-[#a5a2c2] font-mono">{record.fileHash.slice(0, 10)}...{record.fileHash.slice(-6)}</code></span>
        <a
          href={`https://testnet.monadscan.com/address/${contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-brand-purple hover:underline gap-1 font-semibold"
        >
          View Contract on Explorer <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
