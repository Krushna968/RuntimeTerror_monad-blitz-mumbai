"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createPublicClient, http, getAddress } from "viem";
import { Dropzone } from "../components/Dropzone";
import { VerifyWorkflow, AgentStep, StepStatus } from "../components/VerifyWorkflow";
import { OnChainVerifiedCard } from "../components/OnChainVerifiedCard";
import { MintSbtForm } from "../components/MintSbtForm";
import { monadTestnet } from "./providers";
import { Shield, Sparkles, CheckCircle2, ChevronRight, ServerCrash, Loader2, AlertCircle } from "lucide-react";

// Load configurations
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MONAD_CONTRACT_ADDRESS || "0x89D227e7740Cd38e5Fd0a36987c699990836efd0";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
    currentSteps.forEach((s) => {
      s.status = "idle";
      s.result = undefined;
    });
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

  const scrollToVerification = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById("verification-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0E1A] overflow-x-hidden text-on-surface">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-md border-b border-outline-variant/20">
        <div className="flex justify-between items-center px-4 md:px-margin-desktop py-4 max-w-container-max mx-auto w-full">
          <div className="flex items-center space-x-2 font-headline-lg text-headline-lg font-bold tracking-tight text-primary dark:text-primary-fixed-dim">
            <Shield className="h-7 w-7 text-primary-fixed-dim shrink-0" />
            <span>CertiChain AI</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a 
              className="font-body-md text-body-md text-primary dark:text-primary-fixed-dim border-b-2 border-primary-fixed-dim pb-1 transition-colors duration-200" 
              href="#"
            >
              Platform
            </a>
            <a 
              className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="#ai-works"
            >
              AI Agents
            </a>
            <a 
              className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="#monad-blockchain"
            >
              Monad
            </a>
            <a 
              className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="#verification-section"
              onClick={scrollToVerification}
            >
              Verification
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={scrollToVerification}
              className="px-4 md:px-6 py-2 border border-primary-fixed-dim text-primary-fixed-dim rounded-lg hover:bg-primary-fixed-dim/10 transition-all active:scale-95 text-xs md:text-sm font-semibold cursor-pointer"
            >
              Recruiter Login
            </button>
            <Link 
              href="/applicant"
              className="px-4 md:px-6 py-2 bg-primary-fixed-dim text-on-primary-fixed font-bold rounded-lg hover:opacity-90 transition-all active:scale-95 text-xs md:text-sm cursor-pointer block text-center"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden tech-grid">
        <div className="relative z-10 px-4 md:px-margin-desktop max-w-container-max mx-auto w-full">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 glass-card rounded-full text-primary-fixed-dim font-label-caps text-label-caps mb-6 glow-accent">
              TRUST-TECH POWERED BY MONAD
            </span>
            <h1 className="font-headline-xl text-headline-xl mb-6 text-white leading-tight">
              Hire Faster with <span className="text-primary-fixed-dim">Verified Credentials</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-10 max-w-xl">
              CertiChain AI uses Multi-Agent AI and Monad Blockchain to verify resumes and certificates before they reach recruiters. Eliminate fraud at the source.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                href="/applicant"
                className="px-8 py-4 bg-primary-fixed-dim text-on-primary-fixed font-bold rounded-xl text-lg hover:shadow-lg hover:shadow-primary-fixed-dim/20 transition-all active:scale-95 cursor-pointer block text-center"
              >
                Apply Now
              </Link>
              <button 
                onClick={scrollToVerification}
                className="px-8 py-4 glass-card text-white font-bold rounded-xl text-lg hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
              >
                Recruiter Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Verification Section (Injected dynamically) */}
      <section id="verification-section" className="py-24 bg-surface-container-lowest relative border-y border-outline-variant/20 scroll-mt-20">
        <div className="px-4 md:px-margin-desktop max-w-container-max mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block py-1 px-3 glass-card rounded-full text-primary-fixed-dim font-label-caps text-label-caps mb-4 glow-accent uppercase">
              Live Verification Portal
            </span>
            <h2 className="font-headline-lg text-headline-lg mb-4 text-white">Interactive Verification Hub</h2>
            <p className="text-on-surface-variant max-w-xl mx-auto text-body-sm">
              Upload a certificate or resume below. The Multi-Agent AI system will analyze it and check for authenticity on the Monad ledger.
            </p>
            <div className="h-1 w-20 bg-primary-fixed-dim mx-auto mt-6 rounded-full"></div>
          </div>
          
          {/* Banner if backend is down */}
          {!isBackendConnected && (
            <div className="max-w-xl mx-auto mb-8 p-4 bg-red-900/20 border border-error/30 text-error rounded-xl flex items-start space-x-3 text-sm text-left">
              <ServerCrash className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">FastAPI Backend API Offline</span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  The agent server (port 8000) is currently offline. Please run the backend first. Direct Monad blockchain queries will still work.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            
            {/* Left Column: Input Upload */}
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-6 border border-outline-variant/30">
                <h3 className="font-headline-lg text-lg font-bold text-white mb-2 text-left">
                  Upload Credentials
                </h3>
                <p className="text-xs text-on-surface-variant mb-6 text-left">
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
                <div className="glass-card rounded-2xl p-6 border border-outline-variant/30 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-white">AI Assessment Report</h4>
                    <button
                      onClick={() => navigator.clipboard.writeText(aiReport || "")}
                      className="text-xs text-primary-fixed-dim hover:text-white border border-primary-fixed-dim/30 hover:border-primary-fixed-dim px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Copy Report
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={aiReport}
                    className="w-full h-80 bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-xs font-mono text-on-surface-variant focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Right Column: Workflow / Reports */}
            <div className="space-y-6">
              {/* If checking on-chain */}
              {checkingOnChain && (
                <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary-fixed-dim animate-spin mb-4" />
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
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        This certificate's cryptographic footprint is stored in the Monad ledger. Any modifications to the text, layout, or signatures of the certificate file will change its SHA-256 hash and trigger a fail status.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* If not registered onchain and verify is triggered */}
              {!checkingOnChain && !onChainRecord && (selectedFile || isProcessing) && (
                <div className="glass-card rounded-2xl p-6">
                  <VerifyWorkflow steps={workflowSteps} />

                  {/* Classification error results */}
                  {classificationError && (
                    <div className="mt-8 border-t border-outline-variant/30 pt-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="p-5 bg-red-950/20 border border-error/30 rounded-2xl space-y-4">
                        <div className="flex items-center space-x-2 text-error">
                          <AlertCircle className="h-5 w-5" />
                          <h4 className="font-bold text-base">Document Classification Failed</h4>
                        </div>
                        
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Reason for Rejection</p>
                          <p className="text-sm text-white mt-1 leading-relaxed">{classificationError.reason}</p>
                        </div>

                        <div className="border-t border-outline-variant/30 pt-3">
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Instructions</p>
                          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{classificationError.instructions}</p>
                        </div>

                        <div className="bg-[#0A0E1A] border border-outline-variant/30 rounded-xl p-4 text-xs text-on-surface-variant space-y-2 mt-2">
                          <p className="font-semibold text-white uppercase tracking-wider text-[10px]">Verification Cues & Guidance</p>
                          <ul className="list-disc pl-4 space-y-1 text-[#b9cacb]">
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
                    <div className="mt-8 border-t border-outline-variant/30 pt-6 text-left">
                      {aiReport.includes("FRAUD DETECTED") ? (
                        <div className="p-4 bg-red-950/20 border border-error/30 text-error text-sm rounded-2xl flex items-center gap-2">
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
                <div className="glass-card rounded-2xl p-8 text-left">
                  <h3 className="font-headline-lg text-lg font-bold text-white mb-4">
                    Decentralized Security Architecture
                  </h3>
                  <div className="space-y-4 text-sm text-on-surface-variant">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary-fixed-dim/10 rounded-lg text-primary-fixed-dim shrink-0">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">Immutable Registry</h4>
                        <p className="text-xs text-on-surface-variant mt-0.5">Certificates are registered as Soulbound Tokens (SBTs). This binds the credential's metadata and SHA-256 hash to a recipient's wallet address permanently.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-primary-fixed-dim/10 rounded-lg text-primary-fixed-dim shrink-0">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">Multi-Agent AI Review</h4>
                        <p className="text-xs text-on-surface-variant mt-0.5">Four independent LLM agents cross-verify document classification, parse details, search the internet to query institutions, and compile explainable audit reports.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 bg-surface-container-low relative">
        <div className="px-4 md:px-margin-desktop max-w-container-max mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg text-headline-lg mb-4 text-white">Hiring Today is Broken</h2>
            <div className="h-1 w-20 bg-primary-fixed-dim mx-auto rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-center">
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 glass-card rounded-xl">
                <span className="material-symbols-outlined text-error p-2 bg-error/10 rounded-lg">cancel</span>
                <div>
                  <h4 className="font-bold text-white">Fake certificates &amp; credentials</h4>
                  <p className="text-on-surface-variant text-body-sm">Unverified digital copies leading to talent gaps.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 glass-card rounded-xl">
                <span className="material-symbols-outlined text-error p-2 bg-error/10 rounded-lg">warning</span>
                <div>
                  <h4 className="font-bold text-white">Fake internships &amp; experiences</h4>
                  <p className="text-on-surface-variant text-body-sm">Resumes padded with non-existent corporate tenure.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 glass-card rounded-xl">
                <span className="material-symbols-outlined text-error p-2 bg-error/10 rounded-lg">report</span>
                <div>
                  <h4 className="font-bold text-white">Widespread Resume fraud</h4>
                  <p className="text-on-surface-variant text-body-sm">AI-generated experiences that bypass legacy tools.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 glass-card rounded-xl">
                <span className="material-symbols-outlined text-error p-2 bg-error/10 rounded-lg">timer</span>
                <div>
                  <h4 className="font-bold text-white">Manual verification delays</h4>
                  <p className="text-on-surface-variant text-body-sm">HR teams wasting weeks on background checks.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-8 rounded-xl border-l-4 border-primary-fixed-dim col-span-2">
                <div className="font-headline-lg text-primary-fixed-dim mb-2 font-bold">30%</div>
                <p className="text-body-md text-white font-medium">Of resumes contain inaccurate information</p>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="font-headline-lg text-primary-fixed-dim mb-2 font-bold">72h+</div>
                <p className="text-body-sm text-white">Verification takes days of manual labor</p>
              </div>
              <div className="glass-card p-6 rounded-xl">
                <div className="font-headline-lg text-primary-fixed-dim mb-2 font-bold">40%</div>
                <p className="text-body-sm text-white">Recruiters waste time on fake leads</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="px-4 md:px-margin-desktop max-w-container-max mx-auto text-center">
          <h2 className="font-headline-lg text-headline-lg mb-16 text-white">Simple 3-step Verification Flow</h2>
          <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
            {/* Connectors for Desktop */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 -translate-y-1/2 -z-10"></div>
            
            {/* Step 1 */}
            <div className="flex flex-col items-center group w-full md:w-1/3">
              <div className="w-20 h-20 rounded-full glass-card flex items-center justify-center mb-6 border-2 border-primary-fixed-dim/30 group-hover:border-primary-fixed-dim transition-all glow-accent relative z-10 bg-surface">
                <span className="material-symbols-outlined text-primary-fixed-dim text-4xl">upload_file</span>
              </div>
              <h3 className="font-bold text-white mb-2">Applicant Uploads</h3>
              <p className="text-on-surface-variant text-body-sm">Resumes and original certificates securely uploaded.</p>
            </div>
            <div className="md:hidden">
              <span className="material-symbols-outlined text-on-surface-variant">arrow_downward</span>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center group w-full md:w-1/3">
              <div className="w-20 h-20 rounded-full glass-card flex items-center justify-center mb-6 border-2 border-primary-fixed-dim/30 group-hover:border-primary-fixed-dim transition-all glow-accent relative z-10 bg-surface">
                <span className="material-symbols-outlined text-primary-fixed-dim text-4xl">psychology</span>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-fixed-dim rounded-full active-dot"></div>
              </div>
              <h3 className="font-bold text-white mb-2">AI Verification</h3>
              <p className="text-on-surface-variant text-body-sm">Multi-Agent AI analyzes metadata and cross-references data.</p>
            </div>
            <div className="md:hidden">
              <span className="material-symbols-outlined text-on-surface-variant">arrow_downward</span>
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center group w-full md:w-1/3">
              <div className="w-20 h-20 rounded-full glass-card flex items-center justify-center mb-6 border-2 border-primary-fixed-dim/30 group-hover:border-primary-fixed-dim transition-all glow-accent relative z-10 bg-surface">
                <span className="material-symbols-outlined text-primary-fixed-dim text-4xl">verified_user</span>
              </div>
              <h3 className="font-bold text-white mb-2">Verified Delivery</h3>
              <p className="text-on-surface-variant text-body-sm">Recruiter receives 100% authenticated candidate list.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How AI Works */}
      <section id="ai-works" className="py-24 bg-surface-container-highest/30 tech-grid scroll-mt-20">
        <div className="px-4 md:px-margin-desktop max-w-container-max mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
              <h2 className="font-headline-lg text-headline-lg mb-4 text-white">The Multi-Agent Core</h2>
              <p className="text-on-surface-variant max-w-xl">Our orchestration layer coordinates specialized AI agents for deep-level technical validation.</p>
            </div>
            <div className="flex items-center gap-2 font-mono-data text-mono-data text-primary-fixed-dim bg-primary-fixed-dim/5 px-4 py-2 rounded border border-primary-fixed-dim/20">
              <span className="w-2 h-2 bg-primary-fixed-dim rounded-full active-dot"></span>
              SYSTEMS_ONLINE: VERIFY_MODE_ENABLED
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {/* Agent 1 */}
            <div className="glass-card p-8 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-transparent"></div>
              <div className="mb-6 w-12 h-12 flex items-center justify-center bg-primary-fixed-dim/10 rounded-lg group-hover:bg-primary-fixed-dim/20 transition-colors">
                <span className="material-symbols-outlined text-primary-fixed-dim">data_exploration</span>
              </div>
              <h4 className="font-bold text-white mb-3">Document Extraction</h4>
              <p className="text-on-surface-variant text-body-sm">OCR-optimized agent capable of parsing complex formats and signatures.</p>
            </div>
            {/* Agent 2 */}
            <div className="glass-card p-8 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-transparent"></div>
              <div className="mb-6 w-12 h-12 flex items-center justify-center bg-primary-fixed-dim/10 rounded-lg group-hover:bg-primary-fixed-dim/20 transition-colors">
                <span className="material-symbols-outlined text-primary-fixed-dim">verified</span>
              </div>
              <h4 className="font-bold text-white mb-3">Authentication Agent</h4>
              <p className="text-on-surface-variant text-body-sm">Cross-references issuing authorities and signatures across global databases.</p>
            </div>
            {/* Agent 3 */}
            <div className="glass-card p-8 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-transparent"></div>
              <div className="mb-6 w-12 h-12 flex items-center justify-center bg-primary-fixed-dim/10 rounded-lg group-hover:bg-primary-fixed-dim/20 transition-colors">
                <span className="material-symbols-outlined text-primary-fixed-dim">security</span>
              </div>
              <h4 className="font-bold text-white mb-3">Fraud Detection</h4>
              <p className="text-on-surface-variant text-body-sm">Heuristic analysis to identify patterns associated with fake diploma mills.</p>
            </div>
            {/* Agent 4 */}
            <div className="glass-card p-8 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-fixed-dim to-transparent"></div>
              <div className="mb-6 w-12 h-12 flex items-center justify-center bg-primary-fixed-dim/10 rounded-lg group-hover:bg-primary-fixed-dim/20 transition-colors">
                <span className="material-symbols-outlined text-primary-fixed-dim">analytics</span>
              </div>
              <h4 className="font-bold text-white mb-3">Explainability Agent</h4>
              <p className="text-on-surface-variant text-body-sm">Provides human-readable reasoning for every verification score to ensure transparency.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Blockchain Section */}
      <section id="monad-blockchain" className="py-24 bg-[#0A0E1A] relative overflow-hidden scroll-mt-20">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-10 pointer-events-none"></div>
        <div className="px-4 md:px-margin-desktop max-w-container-max mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="font-headline-lg text-headline-lg mb-4 text-white">Powered by Monad Blockchain</h2>
            <p className="text-on-surface-variant">We leverage Monad's high-performance parallel execution to handle enterprise-scale verification with instant finality.</p>
          </div>
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 glass-card p-12 rounded-3xl">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-surface-container rounded-lg mb-4 border border-outline-variant">
                <span className="material-symbols-outlined text-white text-3xl">description</span>
              </div>
              <p className="font-label-caps text-label-caps text-on-surface-variant">DOCUMENT</p>
            </div>
            <div className="hidden lg:block text-primary-fixed-dim">
              <span className="material-symbols-outlined">double_arrow</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-surface-container rounded-lg mb-4 border border-outline-variant">
                <span className="material-symbols-outlined text-white text-3xl">terminal</span>
              </div>
              <p className="font-label-caps text-label-caps text-on-surface-variant">SHA256 HASH</p>
            </div>
            <div className="hidden lg:block text-primary-fixed-dim">
              <span className="material-symbols-outlined">double_arrow</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-primary-fixed-dim/20 rounded-lg mb-4 border border-primary-fixed-dim/40 glow-accent text-primary-fixed-dim">
                <span className="material-symbols-outlined text-3xl">link</span>
              </div>
              <p className="font-label-caps text-label-caps text-primary-fixed-dim">MONAD REGISTRY</p>
            </div>
            <div className="hidden lg:block text-primary-fixed-dim">
              <span className="material-symbols-outlined">double_arrow</span>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-surface-container rounded-lg mb-4 border border-outline-variant">
                <span className="material-symbols-outlined text-white text-3xl">shield_lock</span>
              </div>
              <p className="font-label-caps text-label-caps text-on-surface-variant">TAMPER-PROOF</p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-4 px-6 py-3 glass-card rounded-full border border-primary-fixed-dim/20">
              <img 
                className="w-6 h-6 object-contain" 
                alt="Monad Blockchain Logo" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD94gtGUW--GPdqLlfViLJn0dcDnY2-lpXMuRSzvQKd39ivF9f7s9rIaqTTMtWCt4P2EAINwb8oOmweg7lIt8XSJNg3cjU-HHguPRwyCtZeR1APdlVUqd5ySvc5t5OTrLpxGyqKp6v9AVJLffhOogs1VHfasvgijL9VsdfYInfYpn7RJZvzh_AGuZAA_fdw67cq_VlpxSLJLj_XLL8JmcGM1aI-oGAtM_-lSwcLMBMybjlDSqdlbRBD0m1CKZFlr-DKjP5tKBO9fcrk"
              />
              <span className="text-white font-medium text-xs md:text-sm">Secured by 10,000+ Nodes on Monad Mainnet</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="relative z-10 px-4 md:px-margin-desktop max-w-container-max mx-auto text-center">
          <h2 className="font-headline-xl text-headline-xl mb-8 text-white">Ready to hire trusted talent?</h2>
          <p className="text-on-surface-variant text-body-md mb-12 max-w-2xl mx-auto">
            Join 50+ enterprise partners who have eliminated hiring fraud with CertiChain AI's blockchain-backed verification system.
          </p>
          <Link 
            href="/applicant"
            className="inline-block px-12 py-5 bg-primary-fixed-dim text-on-primary-fixed font-bold rounded-xl text-xl hover:shadow-lg hover:shadow-primary-fixed-dim/20 transition-all active:scale-95 cursor-pointer text-center"
          >
            Start Verification
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/30 w-full py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-margin-desktop gap-gutter max-w-container-max mx-auto w-full">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary-fixed-dim">CertiChain AI</div>
            <p className="text-on-surface-variant font-body-sm text-body-sm max-w-xs text-center md:text-left">
              The next generation of trust-tech for enterprise hiring. Verified, immutable, and instant.
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-8 items-center mt-6 md:mt-0">
            <div className="flex flex-wrap justify-center gap-6">
              <a className="text-on-surface-variant font-body-sm text-body-sm hover:text-primary-fixed-dim transition-colors" href="#">Privacy Policy</a>
              <a className="text-on-surface-variant font-body-sm text-body-sm hover:text-primary-fixed-dim transition-colors" href="#">Terms of Service</a>
              <a className="text-on-surface-variant font-body-sm text-body-sm hover:text-primary-fixed-dim transition-colors" href="#">API Docs</a>
              <a className="text-on-surface-variant font-body-sm text-body-sm hover:text-primary-fixed-dim transition-colors" href="#">Support</a>
            </div>
          </div>
          <div className="text-secondary dark:text-secondary-fixed-dim font-body-sm text-body-sm mt-6 md:mt-0">
            © 2026 CertiChain AI. Secured by Monad Blockchain.
          </div>
        </div>
      </footer>
    </div>
  );
}
