"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { createPublicClient, http, getAddress } from "viem";
import { Dropzone } from "../../components/Dropzone";
import { VerifyWorkflow, AgentStep, StepStatus } from "../../components/VerifyWorkflow";
import { OnChainVerifiedCard } from "../../components/OnChainVerifiedCard";
import { MintSbtForm } from "../../components/MintSbtForm";
import { monadTestnet } from "../providers";
import { Shield, Sparkles, CheckCircle2, ChevronRight, ServerCrash, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

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

export default function ApplicantPortal() {
  // Form fields state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobRole, setJobRole] = useState("Software Engineer");

  // Blockchain verification states
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
      
      // Query Monad Testnet Smart Contract directly via RPC
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
      
      // Auto-fill candidate name if parsed from AI
      if (result.extracted_data?.candidate_name) {
        setFullName(result.extracted_data.candidate_name);
      }
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please upload and verify your certificate first!");
      return;
    }
    if (!onChainRecord && !aiReport) {
      alert("Please verify your document footprint using Multi-Agent AI before submitting!");
      return;
    }
    alert(`Application submitted successfully! Candidate Profile: ${fullName || "Applicant"}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0E1A] overflow-x-hidden text-on-surface">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-md border-b border-outline-variant/20">
        <div className="flex justify-between items-center px-4 md:px-margin-desktop py-4 max-w-container-max mx-auto w-full">
          <Link href="/" className="flex items-center space-x-2 font-headline-lg text-headline-lg font-bold tracking-tight text-primary dark:text-primary-fixed-dim">
            <Shield className="h-7 w-7 text-primary-fixed-dim shrink-0" />
            <span>CertiChain AI</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link 
              className="font-body-md text-body-md text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="/"
            >
              Platform
            </Link>
            <Link 
              className="font-body-md text-body-md text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="/#ai-works"
            >
              AI Agents
            </Link>
            <Link 
              className="font-body-md text-body-md text-on-surface-variant hover:text-primary-fixed-dim transition-colors duration-200" 
              href="/#monad-blockchain"
            >
              Monad
            </Link>
            <Link 
              className="font-body-md text-body-md text-primary dark:text-primary-fixed-dim border-b-2 border-primary-fixed-dim pb-1 transition-colors duration-200" 
              href="#"
            >
              Applicant Portal
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="px-4 md:px-6 py-2 bg-primary-fixed-dim text-on-primary-fixed font-bold rounded-lg hover:opacity-90 transition-all active:scale-95 text-xs md:text-sm cursor-pointer block text-center"
            >
              Log Out
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header Area */}
      <header className="relative pt-32 pb-10 overflow-hidden tech-grid border-b border-outline-variant/10">
        <div className="relative z-10 px-4 md:px-margin-desktop max-w-container-max mx-auto w-full text-center">
          <Link href="/" className="inline-flex items-center text-xs text-primary-fixed-dim hover:underline mb-4 gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
          <div className="max-w-3xl mx-auto">
            <span className="inline-block py-1 px-3 glass-card rounded-full text-primary-fixed-dim font-label-caps text-label-caps mb-4 glow-accent">
              SECURE WEB3 APPLICATIONS
            </span>
            <h1 className="font-headline-xl text-headline-xl mb-4 text-white leading-tight">
              Submit Your <span className="text-primary-fixed-dim font-bold">Verified Profile</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl mx-auto">
              Complete your application form. Verify credentials directly on Monad blockchain prior to recruiter submission.
            </p>
          </div>
        </div>
      </header>

      {/* Main Form & Verification Console Area */}
      <main className="flex-grow max-w-container-max w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* Banner if backend is down */}
        {!isBackendConnected && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-red-900/20 border border-error/30 text-error rounded-xl flex items-start space-x-3 text-sm text-left">
            <ServerCrash className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">FastAPI Backend API Offline</span>
              <p className="text-xs text-on-surface-variant mt-0.5">
                The agent server is offline. Direct Monad blockchain queries will still resolve. Run uvicorn server:app to restore verification.
              </p>
            </div>
          </div>
        )}

        {/* Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mt-4">
          
          {/* Left Column: Form + Upload */}
          <div className="space-y-6">
            
            {/* Applicant Profile Form Card */}
            <div className="glass-card rounded-2xl p-6 border border-outline-variant/30 text-left">
              <h3 className="font-headline-lg text-lg font-bold text-white mb-2">
                1. Personal Professional Profile
              </h3>
              <p className="text-xs text-on-surface-variant mb-6">
                Input your contact details. The system automatically populates Name values from verified certificates.
              </p>
              
              <form className="space-y-4" onSubmit={handleFormSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface">Full Name</label>
                    <input 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      type="text" 
                      placeholder="Alexander Pierce"
                      className="w-full bg-[#121020]/40 border border-[#3b494b]/60 focus:border-[#00dbe9]/50 focus:ring-1 focus:ring-[#00dbe9]/20 rounded p-3 text-sm transition-all text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface">Email Address</label>
                    <input 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email" 
                      placeholder="alex.p@example.com"
                      className="w-full bg-[#121020]/40 border border-[#3b494b]/60 focus:border-[#00dbe9]/50 focus:ring-1 focus:ring-[#00dbe9]/20 rounded p-3 text-sm transition-all text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface">Phone Number</label>
                    <input 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel" 
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-[#121020]/40 border border-[#3b494b]/60 focus:border-[#00dbe9]/50 focus:ring-1 focus:ring-[#00dbe9]/20 rounded p-3 text-sm transition-all text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-on-surface">Job Role</label>
                    <div className="relative">
                      <select 
                        value={jobRole}
                        onChange={(e) => setJobRole(e.target.value)}
                        className="w-full bg-[#121020]/40 border border-[#3b494b]/60 focus:border-[#00dbe9]/50 focus:ring-1 focus:ring-[#00dbe9]/20 rounded p-3 text-sm transition-all text-white focus:outline-none appearance-none cursor-pointer"
                      >
                        <option>Software Engineer</option>
                        <option>Frontend Developer</option>
                        <option>Data Analyst</option>
                        <option>AI Engineer</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant">
                        <span className="material-symbols-outlined text-sm">expand_more</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-outline-variant/20 pt-4 mt-6">
                  <button 
                    type="submit" 
                    className="w-full py-3 bg-primary-fixed-dim text-on-primary-fixed font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Submit Verified Profile</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Document Verification / Upload area */}
            <div className="glass-card rounded-2xl p-6 border border-outline-variant/30 text-left">
              <h3 className="font-headline-lg text-lg font-bold text-white mb-2">
                2. Credentials Verification
              </h3>
              <p className="text-xs text-on-surface-variant mb-6">
                Drag and drop your academic degrees or internship certificates. SHA-256 hash registers verification instantly.
              </p>
              
              <Dropzone
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onClear={handleClear}
                isProcessing={isProcessing}
                onVerify={handleVerify}
              />
            </div>

            {/* AI Text Report Box */}
            {aiReport && (
              <div className="glass-card rounded-2xl p-6 border border-outline-variant/30 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-white">AI Assessment Audit Report</h4>
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

          {/* Right Column: Workflow Progress / Blockchain verification card */}
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
                            recipientName={extractedInfo?.candidate_name || fullName}
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
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/30 w-full py-12">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-margin-desktop gap-gutter max-w-container-max mx-auto w-full">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="font-headline-lg text-headline-lg font-bold text-primary dark:text-primary-fixed-dim text-left">CertiChain AI</div>
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
