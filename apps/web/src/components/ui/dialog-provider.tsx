"use client";

import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from "react";
import styles from "./dialog-provider.module.css";

type DialogOptions = {
  title: string;
  description: string;
  isDestructive?: boolean;
  confirmText?: string;
};

type DialogContextType = {
  alert: (options: Omit<DialogOptions, "isDestructive" | "confirmText">) => Promise<void>;
  confirm: (options: DialogOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirm, setIsConfirm] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  
  const resolverRef = useRef<((value: boolean | void) => void) | null>(null);
  const okButtonRef = useRef<HTMLButtonElement>(null);

  const showAlert = (opts: Omit<DialogOptions, "isDestructive" | "confirmText">) => {
    return new Promise<void>((resolve) => {
      setOptions(opts);
      setIsConfirm(false);
      setIsOpen(true);
      resolverRef.current = resolve as (value: boolean | void) => void;
    });
  };

  const showConfirm = (opts: DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsConfirm(true);
      setIsOpen(true);
      resolverRef.current = resolve as (value: boolean | void) => void;
    });
  };

  const handleClose = (value: boolean) => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && okButtonRef.current) {
      // Small delay to ensure render is complete before focus
      setTimeout(() => okButtonRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose(false);
    }
  };

  return (
    <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}
      {isOpen && options && (
        <div className={styles.backdrop} onClick={() => handleClose(false)} onKeyDown={handleKeyDown}>
          <div 
            className={styles.dialog} 
            onClick={(e) => e.stopPropagation()} 
            role="dialog" 
            aria-modal="true"
          >
            <div className={styles.header}>
              {options.isDestructive && (
                <div className={styles.iconDestructive}>
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
              )}
              <h2 className={styles.title}>{options.title}</h2>
            </div>
            
            <p className={styles.description}>{options.description}</p>
            
            <div className={styles.actions}>
              {isConfirm && (
                <button 
                  className={styles.cancelButton} 
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </button>
              )}
              <button
                ref={okButtonRef}
                className={options.isDestructive ? styles.destructiveButton : styles.primaryButton}
                onClick={() => handleClose(true)}
              >
                {options.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
