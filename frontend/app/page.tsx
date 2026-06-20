"use client";

import React, { useState, useEffect } from "react";
import { createPublicClient, http, getAddress } from "viem";
import { Navbar } from "../components/Navbar";
import { Dropzone } from "../components/Dropzone";
import { VerifyWorkflow, AgentStep } from "../components/VerifyWorkflow";
import { OnChainVerifiedCard } from "../components/OnChainVerifiedCard";
import { MintSbtForm } from "../components/MintSbtForm";
import { monadTestnet } from "./providers";
import { Shield, Sparkles, CheckCircle2, ChevronRight, ServerCrash, Loader2, AlertCircle } from "lucide-react";

// Load configurations (we can fetch this via a Next.js configuration API or simply define a fallback)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MONAD_CONTRACT_ADDRESS || "0x89D227e7740Cd38e5Fd0a36987c699990836efd0";
const BACKEND_URL = "http://localhost:8000";

// Minimal ABI for reading certificate mapping
const READ_ABI = [
  {
    "inputs": [{"internalType": "bytes32", "name": "docHash", "type": "bytes32"}],
    "name": "hashToTokenId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "docHash", "type": "bytes32"}],
    "name": "getCertificateByHash",
    "outputs": [
      {"internalType": "uint256", "name": "tokenId", "type": "uint256"},
      {"internalType": "string", "name": "recipientName", "type": "string"},
      {"internalType": "string", "name": "institutionName", "type": "string"},
      {"internalType": "uint256", "name": "issueDate", "type": "uint256"},
      {"internalType": "uint8", "name": "trustScore", "type": "uint8"},
      {"internalType": "string", "name": "verificationLink", "type": "string"},
      {"internalType": "bool", "name": "isValid", "type": "bool"},
      {"internalType": "address", "name": "recipientWallet", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  
  // On-Chain status states
  const [onChainRecord, setOnChainRecord] = useState<any>(null);
  const [checkingOnChain, setCheckingOnChain] = useState(false);

  // Workflow steps status
  const [workflowSteps, setWorkflowSteps] = useState<AgentStep[]>([
    { name: "Document Classification", description: "Agent 1: Determines if the uploaded document is a valid certificate.", status: "idle" },
    { name: "Key Information Extraction", description: "Agent 2: Parses recipient, issuing organization, dates, signatures, and QR codes.", status: "idle" },
    { name: "Live Authenticator & Score", description: "Agent 3: Cross-references metadata with Web Search (Tavily) to verify credentials.", status: "idle" },
    { name: "Explainable Report Engine", description: "Agent 4: Compiles all findings into a human-readable verified/fraud report.", status: "idle" },
  ]);

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<any>(null);
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [mintSuccessTx, setMintSuccessTx] = useState<string | null>(null);
  const [classificationError, setClassificationError] = useState<{ reason: string; instructions: string } | null>(null);
  const [contractAddress, setContractAddress] = useState<string>("0x89D227e7740Cd38e5Fd0a36987c699990836efd0");

  // Check Backend Health
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => {
        setIsBackendConnected(true);
        if (data.contract_address && data.contract_address.trim() !== "" && data.contract_address.startsWith("0x") && data.contract_address.length === 42) {
          setContractAddress(data.contract_address);
        }
      })
      .catch(() => setIsBackendConnected(false));
  }, []);

  // Compute SHA-256 Hash of uploaded file client-side (Web Crypto API)
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setAiReport(null);
    setExtractedInfo(null);
    setAuthInfo(null);
    setOnChainRecord(null);
    setMintSuccessTx(null);
    setClassificationError(null);
    setWorkflowSteps([
      { name: "Document Classification", description: "Agent 1: Determines if the uploaded document is a valid certificate.", status: "idle" },
      { name: "Key Information Extraction", description: "Agent 2: Parses recipient, issuing organization, dates, signatures, and QR codes.", status: "idle" },
      { name: "Live Authenticator & Score", description: "Agent 3: Cross-references metadata with Web Search (Tavily) to verify credentials.", status: "idle" },
      { name: "Explainable Report Engine", description: "Agent 4: Compiles all findings into a human-readable verified/fraud report.", status: "idle" },
    ]);

    try {
      setCheckingOnChain(true);
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      
      setFileHash(hashHex);
      
      // Query Monad Testnet Smart Contract directly via RPC (Zero connected wallet requirement!)
      if (contractAddress && contractAddress.trim() !== "" && contractAddress.startsWith("0x") && contractAddress.length === 42) {
        const publicClient = createPublicClient({
          chain: monadTestnet,
          transport: http(),
        });
        
        const docHashBytes = `0x${hashHex}`;
        const checksumAddress = getAddress(contractAddress);
        
        // Call contract
        const tokenId = await publicClient.readContract({
          address: checksumAddress,
          abi: READ_ABI,
          functionName: "hashToTokenId",
          args: [docHashBytes],
        }) as bigint;
        
        if (Number(tokenId) > 0) {
          const certData = await publicClient.readContract({
            address: checksumAddress,
            abi: READ_ABI,
            functionName: "getCertificateByHash",
            args: [docHashBytes],
          }) as any[];
          
          setOnChainRecord({
            tokenId: Number(certData[0]),
            recipientName: certData[1],
            institutionName: certData[2],
            issueDate: Number(certData[3]),
            trustScore: Number(certData[4]),
            verificationLink: certData[5],
            isValid: certData[6],
            recipientWallet: certData[7],
            fileHash: hashHex
          });
        }
      }
    } catch (err) {
      console.error("Direct RPC lookup failed:", err);
    } finally {
      setCheckingOnChain(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileHash(null);
    setOnChainRecord(null);
    setAiReport(null);
    setExtractedInfo(null);
    setAuthInfo(null);
    setMintSuccessTx(null);
  };

  // Run Multi-Agent Graph on Backend API
  const handleVerify = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setAiReport(null);
    setMintSuccessTx(null);

    // Reset step statuses to idle
    const currentSteps = [...workflowSteps];
    currentSteps.forEach((s) => (s.status = "idle", s.result = undefined));
    setWorkflowSteps(currentSteps);

    // Helper to update a step status
    const updateStep = (index: number, status: StepStatus, result?: any) => {
      setWorkflowSteps((prev) => {
        const stepsCopy = [...prev];
        stepsCopy[index].status = status;
        if (result) stepsCopy[index].result = result;
        return stepsCopy;
      });
    };

    try {
      // Step 1: Classification
      updateStep(0, "running");
      
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${BACKEND_URL}/api/verify`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process document with backend service.");
      }

      const result = await response.json();

      // Update Step 1 based on Classification
      if (result.stopped_early) {
        updateStep(0, "failed", result.detection_result);
        setIsProcessing(false);
        setClassificationError({
          reason: result.detection_result.reason || "Uploaded document does not appear to be a valid certificate.",
          instructions: result.detection_result.instructions || "Please check the document format and upload a valid certificate."
        });
        return;
      }
      
      updateStep(0, "completed", result.detection_result);

      // Step 2: Information Extraction
      updateStep(1, "running");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateStep(1, "completed", result.extracted_data);
      setExtractedInfo(result.extracted_data);

      // Step 3: Live Verification
      updateStep(2, "running");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateStep(2, "completed", result.auth_result);
      setAuthInfo(result.auth_result);

      // Step 4: Final Report Engine
      updateStep(3, "running");
      await new Promise((resolve) => setTimeout(resolve, 800));
      updateStep(3, "completed");

      setAiReport(result.explanation);
    } catch (err) {
      console.error(err);
      setWorkflowSteps((prev) => {
        const copy = [...prev];
        const activeIdx = copy.findIndex((s) => s.status === "running");
        if (activeIdx !== -1) copy[activeIdx].status = "failed";
        return copy;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMintSuccess = (txHash: string) => {
    setMintSuccessTx(txHash);
    // Refresh record to mark as onchain verified after 3 seconds
    setTimeout(async () => {
      if (selectedFile) {
        await handleFileSelect(selectedFile);
      }
    }, 3000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#06050b] grid-bg relative overflow-x-hidden">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* Banner if backend is down */}
        {!isBackendConnected && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-red-900/20 border border-[#ff007a]/30 text-brand-pink rounded-2xl flex items-start space-x-3 text-sm text-left">
            <ServerCrash className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">FastAPI Backend API Offline</span>
              <p className="text-xs text-[#a5a2c2] mt-0.5">
                The agent server (port 8000) is currently offline. Please run the start script or run `uvicorn server:app` to start it. Direct Monad blockchain queries will still work.
              </p>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#1b1932]/60 border border-[#836efd]/30 text-xs font-semibold text-brand-purple mb-6 animate-pulse-slow">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Monad Parallel Execution Enabled</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#836efd]" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Next-Gen Certificate <br />
            <span className="bg-gradient-to-r from-brand-purple via-[#a000ff] to-brand-pink bg-clip-text text-transparent">
              Decentralized Verifier
            </span>
          </h1>
          <p className="text-base text-[#a5a2c2] mt-4 font-light leading-relaxed">
            CertiChain AI combines Multi-Agent LangGraph intelligence on Groq with high-speed Monad Testnet Soulbound Tokens (SBTs) to guarantee zero forgery.
          </p>
        </div>

        {/* Interactive Layout split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mt-8">
          
          {/* Left Column: Input Upload */}
          <div className="space-y-6">
            <div className="bg-[#121020]/25 rounded-2xl p-6 border border-[#231f42]/60 backdrop-blur-md">
              <h3 className="font-display text-lg font-bold text-white mb-2 text-left">
                Step 1: Upload Credentials
              </h3>
              <p className="text-xs text-[#8c8aab] mb-6 text-left">
                Drop your certificate file. The system will verify its hash on-chain instantaneously. If unregistered, you can trigger our AI verification model.
              </p>
              <Dropzone
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onClear={handleClear}
                isProcessing={isProcessing}
                onVerify={handleVerify}
              />
            </div>

            {/* AI Text Report Box (Under Upload Option) */}
            {aiReport && (
              <div className="bg-[#121020]/25 rounded-2xl p-6 border border-[#231f42]/60 backdrop-blur-md text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-display font-semibold text-white">AI Assessment Report</h4>
                  <button
                    onClick={() => navigator.clipboard.writeText(aiReport)}
                    className="text-xs text-brand-purple hover:text-white border border-brand-purple/30 hover:border-brand-purple px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Copy Report
                  </button>
                </div>
                <textarea
                  readOnly
                  value={aiReport}
                  className="w-full h-80 bg-[#090812] border border-[#231f42] rounded-xl p-4 text-xs font-mono text-[#a5a2c2] focus:outline-none resize-none leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Right Column: Workflow / Reports */}
          <div className="space-y-6">
            {/* If checking on-chain */}
            {checkingOnChain && (
              <div className="bg-[#121020]/20 border border-[#231f42] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 text-brand-purple animate-spin mb-4" />
                <p className="text-sm text-white">Scanning Monad ledger registries...</p>
              </div>
            )}

            {/* If registered on-chain */}
            {!checkingOnChain && onChainRecord && (
              <div className="space-y-6">
                <OnChainVerifiedCard record={onChainRecord} contractAddress={CONTRACT_ADDRESS} />
                
                {/* Visual success alert */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-sm p-4 rounded-xl flex items-start space-x-3 text-left">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <span className="font-bold">Tamper-Proof Verification Confirmed</span>
                    <p className="text-xs text-[#a5a2c2] mt-0.5">
                      This certificate's cryptographic footprint is stored in the Monad ledger. Any modifications to the text, layout, or signatures of the certificate file will change its SHA-256 hash and trigger a fail status.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* If not registered onchain and verify is triggered */}
            {!checkingOnChain && !onChainRecord && (selectedFile || isProcessing) && (
              <div className="bg-[#121020]/20 border border-[#231f42] rounded-2xl p-6 backdrop-blur-md">
                <VerifyWorkflow steps={workflowSteps} />

                {/* Classification error results */}
                {classificationError && (
                  <div className="mt-8 border-t border-[#231f42] pt-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="p-5 bg-red-950/20 border border-brand-pink/30 rounded-2xl space-y-4">
                      <div className="flex items-center space-x-2 text-brand-pink">
                        <AlertCircle className="h-5 w-5" />
                        <h4 className="font-display font-bold text-base">Document Classification Failed</h4>
                      </div>
                      
                      <div>
                        <p className="text-xs font-semibold text-[#8c8aab] uppercase tracking-wider">Reason for Rejection</p>
                        <p className="text-sm text-white mt-1 leading-relaxed">{classificationError.reason}</p>
                      </div>

                      <div className="border-t border-[#231f42] pt-3">
                        <p className="text-xs font-semibold text-[#8c8aab] uppercase tracking-wider">Instructions</p>
                        <p className="text-sm text-[#a5a2c2] mt-1 leading-relaxed">{classificationError.instructions}</p>
                      </div>

                      <div className="bg-[#090812] border border-[#231f42] rounded-xl p-4 text-xs text-[#8c8aab] space-y-2 mt-2">
                        <p className="font-semibold text-white uppercase tracking-wider text-[10px]">Verification Cues & Guidance</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Ensure the document contains visible certificate headers like "Certificate of Completion", "Degree", or "Diploma".</li>
                          <li>Make sure the candidate's name and the issuing institution's name are clearly legible.</li>
                          <li>Check that the document has not been cropped, distorted, or heavily pixelated.</li>
                          <li>Only upload standard PDF or image files (PNG, JPG, JPEG) up to 10MB in size.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final AI report results */}
                {aiReport && (
                  <div className="mt-8 border-t border-[#231f42] pt-6 text-left">
                    {aiReport.includes("FRAUD DETECTED") ? (
                      <div className="p-4 bg-red-950/20 border border-[#ff007a]/30 text-brand-pink text-sm rounded-2xl flex items-center gap-2">
                        <span className="font-bold text-base">⚠️ AI Verification: FRAUD DETECTED</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-sm rounded-2xl flex items-center gap-2">
                          <span className="font-bold text-base">🛡️ AI Verification: VERIFIED GENUINE</span>
                        </div>

                        {/* SBT minting option */}
                        {selectedFile && (
                          <MintSbtForm
                            file={selectedFile}
                            fileHash={fileHash || ""}
                            recipientName={extractedInfo?.candidate_name}
                            institutionName={extractedInfo?.institution_name}
                            issueDateStr={extractedInfo?.issue_date}
                            trustScore={authInfo?.trust_score || 100}
                            verificationLink={authInfo?.verification_link || ""}
                            contractAddress={CONTRACT_ADDRESS}
                            onSuccess={handleMintSuccess}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Default side view */}
            {!selectedFile && !isProcessing && !checkingOnChain && (
              <div className="bg-[#121020]/20 border border-[#231f42] rounded-2xl p-8 text-center text-left">
                <h3 className="font-display text-lg font-bold text-white mb-4">
                  Decentralized Security Architecture
                </h3>
                <div className="space-y-4 text-sm text-[#a5a2c2]">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-brand-purple/10 rounded-lg text-brand-purple shrink-0">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Immutable Registry</h4>
                      <p className="text-xs text-[#8c8aab] mt-0.5">Certificates are registered as Soulbound Tokens. This binds the credential's metadata and SHA-256 hash to a recipient's public key forever.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-brand-pink/10 rounded-lg text-brand-pink shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Multi-Agent AI Review</h4>
                      <p className="text-xs text-[#8c8aab] mt-0.5">Four independent LLM agents cross-verify document classification, parse details, search the internet to query institutions, and compile explainable audit reports.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </main>

      <footer className="py-8 border-t border-[#231f42] bg-[#06050b] text-center text-xs text-[#8c8aab] z-10">
        <p>© 2026 CertiChain AI. Powered by Monad Layer 1 Parallelized EVM.</p>
      </footer>
    </div>
  );
}
