"use client";

import React, { useCallback, useState } from "react";
import { Upload, File, X, Sparkles } from "lucide-react";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  isProcessing: boolean;
  onVerify: () => void;
}

export function Dropzone({
  onFileSelect,
  selectedFile,
  onClear,
  isProcessing,
  onVerify,
}: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext && ["pdf", "jpg", "jpeg", "png"].includes(ext)) {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative group cursor-pointer flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isDragActive
              ? "border-brand-purple bg-brand-purple/5 shadow-2xl scale-[1.01]"
              : "border-[#231f42] hover:border-brand-purple/50 bg-[#121020]/40"
          }`}
        >
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileInput}
          />
          <div className="p-4 bg-[#1b1932] rounded-full text-[#a5a2c2] group-hover:text-brand-purple transition-colors mb-4">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="font-display text-lg font-semibold text-white mb-2">
            Upload Certificate
          </h3>
          <p className="text-sm text-[#a5a2c2] max-w-sm mb-4">
            Drag and drop your file here, or click to browse. Supports PDF, PNG, and JPG.
          </p>
          <span className="text-[11px] text-[#836efd] uppercase font-bold tracking-widest bg-[#1b1932] px-2.5 py-1 rounded-md">
            SHA-256 Calculated Instantaneously
          </span>
        </div>
      ) : (
        <div className="glow-card bg-[#121020]/60 rounded-2xl p-6 border border-[#231f42]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-[#1b1932] rounded-xl text-brand-purple">
                <File className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h4 className="font-display text-base font-semibold text-white truncate max-w-md">
                  {selectedFile.name}
                </h4>
                <p className="text-xs text-[#a5a2c2]">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={onClear}
                className="p-1.5 bg-[#231f42]/50 hover:bg-[#ff007a]/20 text-[#a5a2c2] hover:text-brand-pink rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-col space-y-3">
            <button
              onClick={onVerify}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-brand-purple to-brand-pink hover:shadow-lg hover:shadow-brand-purple/20 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
              {isProcessing ? "Analyzing Document..." : "Authenticate with Multi-Agent AI"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
