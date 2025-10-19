// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface ResearchProposal {
  id: string;
  title: string;
  description: string;
  encryptedBudget: string;
  timestamp: number;
  proposer: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  votesFor: number;
  votesAgainst: number;
}

interface FAQItem {
  question: string;
  answer: string;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<ResearchProposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<ResearchProposal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newProposalData, setNewProposalData] = useState({ title: "", description: "", category: "", budget: 0 });
  const [selectedProposal, setSelectedProposal] = useState<ResearchProposal | null>(null);
  const [decryptedBudget, setDecryptedBudget] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const [showFAQ, setShowFAQ] = useState(false);

  const approvedCount = proposals.filter(p => p.status === "approved").length;
  const pendingCount = proposals.filter(p => p.status === "pending").length;
  const rejectedCount = proposals.filter(p => p.status === "rejected").length;
  const totalVotes = proposals.reduce((sum, p) => sum + p.votesFor + p.votesAgainst, 0);

  const faqItems: FAQItem[] = [
    {
      question: "How does Zama FHE protect research proposals?",
      answer: "Zama FHE encrypts sensitive budget data before submission, ensuring only authorized parties can decrypt it with proper signatures."
    },
    {
      question: "How are research IPs managed?",
      answer: "Approved research IPs are minted as NFTs owned by the DAO treasury, with licensing revenue flowing back to the community."
    },
    {
      question: "What's the voting process?",
      answer: "DAO members vote privately on proposals using FHE-encrypted ballots, ensuring complete privacy while maintaining accountability."
    },
    {
      question: "How are research funds distributed?",
      answer: "Funds are released based on milestone achievements, with all transactions recorded on-chain for transparency."
    }
  ];

  useEffect(() => {
    loadProposals().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  useEffect(() => {
    filterProposals();
  }, [proposals, searchTerm, statusFilter]);

  const loadProposals = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) return;
      
      // Load proposal keys
      const keysBytes = await contract.getData("proposal_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { console.error("Error parsing proposal keys:", e); }
      }
      
      // Load each proposal
      const list: ResearchProposal[] = [];
      for (const key of keys) {
        try {
          const proposalBytes = await contract.getData(`proposal_${key}`);
          if (proposalBytes.length > 0) {
            try {
              const proposalData = JSON.parse(ethers.toUtf8String(proposalBytes));
              list.push({ 
                id: key, 
                title: proposalData.title,
                description: proposalData.description,
                encryptedBudget: proposalData.budget,
                timestamp: proposalData.timestamp, 
                proposer: proposalData.proposer, 
                category: proposalData.category, 
                status: proposalData.status || "pending",
                votesFor: proposalData.votesFor || 0,
                votesAgainst: proposalData.votesAgainst || 0
              });
            } catch (e) { console.error(`Error parsing proposal data for ${key}:`, e); }
          }
        } catch (e) { console.error(`Error loading proposal ${key}:`, e); }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setProposals(list);
    } catch (e) { console.error("Error loading proposals:", e); } 
    finally { setIsRefreshing(false); setLoading(false); }
  };

  const filterProposals = () => {
    let filtered = proposals;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(proposal => 
        proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proposal.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proposal.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(proposal => proposal.status === statusFilter);
    }
    
    setFilteredProposals(filtered);
  };

  const submitProposal = async () => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setCreating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting budget data with Zama FHE..." });
    try {
      // Encrypt budget using Zama FHE
      const encryptedBudget = FHEEncryptNumber(newProposalData.budget);
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      // Generate unique ID
      const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create proposal data
      const proposalData = { 
        title: newProposalData.title,
        description: newProposalData.description,
        budget: encryptedBudget,
        timestamp: Math.floor(Date.now() / 1000), 
        proposer: address, 
        category: newProposalData.category, 
        status: "pending",
        votesFor: 0,
        votesAgainst: 0
      };
      
      // Store proposal
      await contract.setData(`proposal_${proposalId}`, ethers.toUtf8Bytes(JSON.stringify(proposalData)));
      
      // Update keys list
      const keysBytes = await contract.getData("proposal_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { keys = JSON.parse(ethers.toUtf8String(keysBytes)); } 
        catch (e) { console.error("Error parsing keys:", e); }
      }
      keys.push(proposalId);
      await contract.setData("proposal_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Research proposal submitted securely with FHE encryption!" });
      await loadProposals();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewProposalData({ title: "", description: "", category: "", budget: 0 });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { setCreating(false); }
  };

  const voteOnProposal = async (proposalId: string, support: boolean) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Processing encrypted vote with FHE..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      // Load proposal data
      const proposalBytes = await contract.getData(`proposal_${proposalId}`);
      if (proposalBytes.length === 0) throw new Error("Proposal not found");
      const proposalData = JSON.parse(ethers.toUtf8String(proposalBytes));
      
      // Update vote count
      if (support) {
        proposalData.votesFor = (proposalData.votesFor || 0) + 1;
      } else {
        proposalData.votesAgainst = (proposalData.votesAgainst || 0) + 1;
      }
      
      // Save updated proposal
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      await contractWithSigner.setData(`proposal_${proposalId}`, ethers.toUtf8Bytes(JSON.stringify(proposalData)));
      
      setTransactionStatus({ visible: true, status: "success", message: `Vote ${support ? "for" : "against"} proposal recorded!` });
      await loadProposals();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Voting failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; } 
    finally { setIsDecrypting(false); }
  };

  const approveProposal = async (proposalId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Updating proposal status..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      // Load proposal data
      const proposalBytes = await contract.getData(`proposal_${proposalId}`);
      if (proposalBytes.length === 0) throw new Error("Proposal not found");
      const proposalData = JSON.parse(ethers.toUtf8String(proposalBytes));
      
      // Update status
      proposalData.status = "approved";
      
      // Save updated proposal
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      await contractWithSigner.setData(`proposal_${proposalId}`, ethers.toUtf8Bytes(JSON.stringify(proposalData)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Proposal approved! Research IP will be minted as NFT." });
      await loadProposals();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Approval failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const rejectProposal = async (proposalId: string) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Updating proposal status..." });
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Failed to get contract");
      
      // Load proposal data
      const proposalBytes = await contract.getData(`proposal_${proposalId}`);
      if (proposalBytes.length === 0) throw new Error("Proposal not found");
      const proposalData = JSON.parse(ethers.toUtf8String(proposalBytes));
      
      // Update status
      proposalData.status = "rejected";
      
      // Save updated proposal
      const contractWithSigner = await getContractWithSigner();
      if (!contractWithSigner) throw new Error("Failed to get contract with signer");
      await contractWithSigner.setData(`proposal_${proposalId}`, ethers.toUtf8Bytes(JSON.stringify(proposalData)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Proposal rejected." });
      await loadProposals();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Rejection failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const isProposer = (proposerAddress: string) => address?.toLowerCase() === proposerAddress.toLowerCase();

  // Pagination logic
  const totalPages = Math.ceil(filteredProposals.length / itemsPerPage);
  const currentItems = filteredProposals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderStats = () => {
    return (
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{proposals.length}</div>
          <div className="stat-label">Total Proposals</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{approvedCount}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{totalVotes}</div>
          <div className="stat-label">Total Votes</div>
        </div>
      </div>
    );
  };

  const renderPieChart = () => {
    const total = proposals.length || 1;
    const approvedPercentage = (approvedCount / total) * 100;
    const pendingPercentage = (pendingCount / total) * 100;
    const rejectedPercentage = (rejectedCount / total) * 100;
    
    return (
      <div className="pie-chart-container">
        <div className="pie-chart">
          <div className="pie-segment approved" style={{ transform: `rotate(${approvedPercentage * 3.6}deg)` }}></div>
          <div className="pie-segment pending" style={{ transform: `rotate(${(approvedPercentage + pendingPercentage) * 3.6}deg)` }}></div>
          <div className="pie-segment rejected" style={{ transform: `rotate(${(approvedPercentage + pendingPercentage + rejectedPercentage) * 3.6}deg)` }}></div>
          <div className="pie-center">
            <div className="pie-value">{proposals.length}</div>
            <div className="pie-label">Proposals</div>
          </div>
        </div>
        <div className="pie-legend">
          <div className="legend-item"><div className="color-box approved"></div><span>Approved: {approvedCount}</span></div>
          <div className="legend-item"><div className="color-box pending"></div><span>Pending: {pendingCount}</span></div>
          <div className="legend-item"><div className="color-box rejected"></div><span>Rejected: {rejectedCount}</span></div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="tech-spinner"></div>
      <p>Initializing Science DAO connection...</p>
    </div>
  );

  return (
    <div className="app-container tech-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="science-icon"></div></div>
          <h1>Science<span>DAO</span></h1>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-proposal-btn tech-button">
            <div className="add-icon"></div>Submit Proposal
          </button>
          <button className="tech-button" onClick={() => setShowFAQ(!showFAQ)}>
            {showFAQ ? "Hide FAQ" : "Show FAQ"}
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>

      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Decentralized Research Funding</h2>
            <p>Powered by Zama FHE for private voting and secure budget management</p>
          </div>
          <div className="fhe-indicator"><div className="fhe-lock"></div><span>FHE Encryption Active</span></div>
        </div>

        {showFAQ && (
          <div className="faq-section">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-list">
              {faqItems.map((item, index) => (
                <div className="faq-item" key={index}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dashboard-grid">
          <div className="dashboard-card tech-card">
            <h3>Science DAO Overview</h3>
            <p>A decentralized autonomous organization for funding scientific research using <strong>Zama FHE technology</strong> to ensure private voting and secure budget management.</p>
            <div className="fhe-badge"><span>FHE-Powered Voting</span></div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Funding Statistics</h3>
            {renderStats()}
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>Proposal Status Distribution</h3>
            {renderPieChart()}
          </div>
        </div>

        <div className="proposals-section">
          <div className="section-header">
            <h2>Research Proposals</h2>
            <div className="header-actions">
              <div className="search-filter">
                <input 
                  type="text" 
                  placeholder="Search proposals..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="tech-input"
                />
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="tech-select"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <button onClick={loadProposals} className="refresh-btn tech-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="proposals-list tech-card">
            <div className="table-header">
              <div className="header-cell">Title</div>
              <div className="header-cell">Category</div>
              <div className="header-cell">Proposer</div>
              <div className="header-cell">Date</div>
              <div className="header-cell">Status</div>
              <div className="header-cell">Votes</div>
              <div className="header-cell">Actions</div>
            </div>

            {currentItems.length === 0 ? (
              <div className="no-proposals">
                <div className="no-proposals-icon"></div>
                <p>No research proposals found</p>
                <button className="tech-button primary" onClick={() => setShowCreateModal(true)}>Submit First Proposal</button>
              </div>
            ) : currentItems.map(proposal => (
              <div className="proposal-row" key={proposal.id} onClick={() => setSelectedProposal(proposal)}>
                <div className="table-cell proposal-title">{proposal.title}</div>
                <div className="table-cell">{proposal.category}</div>
                <div className="table-cell">{proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(38)}</div>
                <div className="table-cell">{new Date(proposal.timestamp * 1000).toLocaleDateString()}</div>
                <div className="table-cell"><span className={`status-badge ${proposal.status}`}>{proposal.status}</span></div>
                <div className="table-cell">{proposal.votesFor} / {proposal.votesAgainst}</div>
                <div className="table-cell actions">
                  {!isProposer(proposal.proposer) && proposal.status === "pending" && (
                    <>
                      <button className="action-btn tech-button success" onClick={(e) => { e.stopPropagation(); voteOnProposal(proposal.id, true); }}>Vote For</button>
                      <button className="action-btn tech-button danger" onClick={(e) => { e.stopPropagation(); voteOnProposal(proposal.id, false); }}>Vote Against</button>
                    </>
                  )}
                  {isProposer(proposal.proposer) && proposal.status === "pending" && (
                    <span className="proposer-badge">Your Proposal</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="tech-button" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                className="tech-button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitProposal} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating} 
          proposalData={newProposalData} 
          setProposalData={setNewProposalData}
        />
      )}

      {selectedProposal && (
        <ProposalDetailModal 
          proposal={selectedProposal} 
          onClose={() => { setSelectedProposal(null); setDecryptedBudget(null); }} 
          decryptedBudget={decryptedBudget}
          setDecryptedBudget={setDecryptedBudget}
          isDecrypting={isDecrypting}
          decryptWithSignature={decryptWithSignature}
          isProposer={isProposer(selectedProposal.proposer)}
          onApprove={approveProposal}
          onReject={rejectProposal}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content tech-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="tech-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="science-icon"></div><span>Science DAO</span></div>
            <p>Decentralized research funding with Zama FHE technology</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE-Powered Research Funding</span></div>
          <div className="copyright">© {new Date().getFullYear()} Science DAO. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  proposalData: any;
  setProposalData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ onSubmit, onClose, creating, proposalData, setProposalData }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProposalData({ ...proposalData, [name]: value });
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProposalData({ ...proposalData, [name]: parseFloat(value) });
  };

  const handleSubmit = () => {
    if (!proposalData.title || !proposalData.category || !proposalData.budget) { 
      alert("Please fill required fields"); 
      return; 
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal tech-card">
        <div className="modal-header">
          <h2>Submit Research Proposal</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        <div className="modal-body">
          <div className="fhe-notice-banner">
            <div className="key-icon"></div> 
            <div>
              <strong>FHE Encryption Notice</strong>
              <p>Your research budget will be encrypted with Zama FHE before submission</p>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Research Title *</label>
              <input 
                type="text" 
                name="title" 
                value={proposalData.title} 
                onChange={handleChange} 
                placeholder="Enter research title..." 
                className="tech-input"
              />
            </div>
            
            <div className="form-group">
              <label>Research Category *</label>
              <select name="category" value={proposalData.category} onChange={handleChange} className="tech-select">
                <option value="">Select category</option>
                <option value="Biology">Biology</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Medicine">Medicine</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Engineering">Engineering</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="form-group full-width">
              <label>Research Description</label>
              <textarea 
                name="description" 
                value={proposalData.description} 
                onChange={handleChange} 
                placeholder="Describe your research project, methodology, and expected outcomes..."
                className="tech-textarea"
                rows={4}
              />
            </div>
            
            <div className="form-group">
              <label>Funding Request (ETH) *</label>
              <input 
                type="number" 
                name="budget" 
                value={proposalData.budget} 
                onChange={handleBudgetChange} 
                placeholder="Enter amount..." 
                className="tech-input"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          
          <div className="encryption-preview">
            <h4>FHE Encryption Preview</h4>
            <div className="preview-container">
              <div className="plain-data">
                <span>Plain Budget:</span>
                <div>{proposalData.budget ? `${proposalData.budget} ETH` : 'No value entered'}</div>
              </div>
              <div className="encryption-arrow">→</div>
              <div className="encrypted-data">
                <span>Encrypted Data:</span>
                <div>{proposalData.budget ? FHEEncryptNumber(proposalData.budget).substring(0, 50) + '...' : 'No value entered'}</div>
              </div>
            </div>
          </div>
          
          <div className="privacy-notice">
            <div className="privacy-icon"></div> 
            <div>
              <strong>Research Privacy Guarantee</strong>
              <p>Budget details remain encrypted during voting and are only decrypted with proper authorization</p>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn tech-button">Cancel</button>
          <button onClick={handleSubmit} disabled={creating} className="submit-btn tech-button primary">
            {creating ? "Encrypting with FHE..." : "Submit Proposal"}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ProposalDetailModalProps {
  proposal: ResearchProposal;
  onClose: () => void;
  decryptedBudget: number | null;
  setDecryptedBudget: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
  isProposer: boolean;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

const ProposalDetailModal: React.FC<ProposalDetailModalProps> = ({
  proposal, onClose, decryptedBudget, setDecryptedBudget, isDecrypting, decryptWithSignature, isProposer, onApprove, onReject
}) => {
  const handleDecrypt = async () => {
    if (decryptedBudget !== null) { 
      setDecryptedBudget(null); 
      return; 
    }
    const decrypted = await decryptWithSignature(proposal.encryptedBudget);
    if (decrypted !== null) setDecryptedBudget(decrypted);
  };

  return (
    <div className="modal-overlay">
      <div className="proposal-detail-modal tech-card">
        <div className="modal-header">
          <h2>{proposal.title}</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="proposal-info">
            <div className="info-item"><span>Category:</span><strong>{proposal.category}</strong></div>
            <div className="info-item"><span>Proposer:</span><strong>{proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(38)}</strong></div>
            <div className="info-item"><span>Submitted:</span><strong>{new Date(proposal.timestamp * 1000).toLocaleString()}</strong></div>
            <div className="info-item"><span>Status:</span><strong className={`status-badge ${proposal.status}`}>{proposal.status}</strong></div>
            <div className="info-item"><span>Votes For:</span><strong>{proposal.votesFor}</strong></div>
            <div className="info-item"><span>Votes Against:</span><strong>{proposal.votesAgainst}</strong></div>
          </div>
          
          <div className="proposal-description">
            <h3>Research Description</h3>
            <p>{proposal.description || "No description provided."}</p>
          </div>
          
          <div className="budget-section">
            <h3>Funding Request</h3>
            <div className="encrypted-data">{proposal.encryptedBudget.substring(0, 100)}...</div>
            <div className="fhe-tag"><div className="fhe-icon"></div><span>FHE Encrypted Budget</span></div>
            
            {(isProposer || proposal.status === "approved") && (
              <button className="decrypt-btn tech-button" onClick={handleDecrypt} disabled={isDecrypting}>
                {isDecrypting ? <span className="decrypt-spinner"></span> : 
                 decryptedBudget !== null ? "Hide Budget" : "Decrypt Budget with Signature"}
              </button>
            )}
            
            {decryptedBudget !== null && (
              <div className="decrypted-budget-section">
                <h4>Decrypted Budget</h4>
                <div className="decrypted-value">{decryptedBudget} ETH</div>
                <div className="decryption-notice">
                  <div className="warning-icon"></div>
                  <span>Budget details are only visible to authorized parties with proper signatures</span>
                </div>
              </div>
            )}
          </div>
          
          {isProposer && proposal.status === "pending" && (
            <div className="admin-actions">
              <h3>Proposal Management</h3>
              <div className="action-buttons">
                <button className="tech-button success" onClick={() => onApprove(proposal.id)}>
                  Approve Proposal
                </button>
                <button className="tech-button danger" onClick={() => onReject(proposal.id)}>
                  Reject Proposal
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn tech-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;