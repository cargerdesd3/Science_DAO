pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract Science_DAO_FHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    bool public batchOpen;

    struct Proposal {
        euint32 encryptedFundingAmount; // Encrypted funding amount requested
        euint32 encryptedImpactScore;   // Encrypted impact score (e.g., 1-100)
        euint32 encryptedFeasibilityScore; // Encrypted feasibility score (e.g., 1-100)
        euint32 encryptedNoveltyScore; // Encrypted novelty score (e.g., 1-100)
        bool exists;
    }
    mapping(uint256 => mapping(address => Proposal)) public batchProposals; // batchId => provider => Proposal

    struct Vote {
        ebool encryptedVote; // Encrypted vote (true for approve, false for reject)
        bool exists;
    }
    mapping(uint256 => mapping(address => mapping(address => Vote))) public proposalVotes; // batchId => proposalProvider => voter => Vote

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    // Custom Errors
    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchClosed();
    error ProposalDoesNotExist();
    error VoteDoesNotExist();
    error InvalidBatchState();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidCleartextLength();

    // Events
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event PausedContract(address indexed account);
    event UnpausedContract(address indexed account);
    event CooldownSecondsSet(uint256 oldCooldown, uint256 newCooldown);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event ProposalSubmitted(address indexed provider, uint256 indexed batchId, bytes32 encryptedFundingAmount, bytes32 encryptedImpactScore, bytes32 encryptedFeasibilityScore, bytes32 encryptedNoveltyScore);
    event VoteSubmitted(address indexed voter, uint256 indexed batchId, address indexed proposalProvider, bytes32 encryptedVote);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalApprovedProposals, uint256 totalFundingAmount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        emit ProviderAdded(owner);
        cooldownSeconds = 60; // Default cooldown
        currentBatchId = 1; // Start with batch 1
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit PausedContract(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert InvalidBatchState(); // Or a more specific error
        paused = false;
        emit UnpausedContract(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsSet(oldCooldown, newCooldownSeconds);
    }

    function openBatch() external onlyOwner whenNotPaused {
        if (batchOpen) revert InvalidBatchState();
        batchOpen = true;
        currentBatchId++;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        if (!batchOpen) revert InvalidBatchState();
        batchOpen = false;
        emit BatchClosed(currentBatchId);
    }

    function submitProposal(
        euint32 _encryptedFundingAmount,
        euint32 _encryptedImpactScore,
        euint32 _encryptedFeasibilityScore,
        euint32 _encryptedNoveltyScore
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (!batchOpen) revert BatchClosed();

        uint256 batchId = currentBatchId;
        Proposal storage proposal = batchProposals[batchId][msg.sender];

        proposal.encryptedFundingAmount = _encryptedFundingAmount;
        proposal.encryptedImpactScore = _encryptedImpactScore;
        proposal.encryptedFeasibilityScore = _encryptedFeasibilityScore;
        proposal.encryptedNoveltyScore = _encryptedNoveltyScore;
        proposal.exists = true;

        lastSubmissionTime[msg.sender] = block.timestamp;
        emit ProposalSubmitted(
            msg.sender,
            batchId,
            _encryptedFundingAmount.toBytes32(),
            _encryptedImpactScore.toBytes32(),
            _encryptedFeasibilityScore.toBytes32(),
            _encryptedNoveltyScore.toBytes32()
        );
    }

    function submitVote(
        uint256 batchId,
        address proposalProvider,
        ebool _encryptedVote
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) { // Reusing submission cooldown for simplicity
            revert CooldownActive();
        }
        // Check if proposal exists
        if (!batchProposals[batchId][proposalProvider].exists) {
            revert ProposalDoesNotExist();
        }

        Vote storage vote = proposalVotes[batchId][proposalProvider][msg.sender];
        vote.encryptedVote = _encryptedVote;
        vote.exists = true;

        lastSubmissionTime[msg.sender] = block.timestamp; // Update submission time
        emit VoteSubmitted(msg.sender, batchId, proposalProvider, _encryptedVote.toBytes32());
    }

    function requestBatchResultDecryption(uint256 batchId) external onlyOwner whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        // Basic check: batch should be closed for results
        if (batchId == currentBatchId && batchOpen) revert InvalidBatchState(); // Cannot request for currently open batch

        // 1. Prepare Ciphertexts
        // For simplicity, this example will only decrypt the total approved proposals and total funding.
        // A real system might decrypt individual proposal results or more complex aggregations.
        // Here, we'll assume these aggregated values are already computed and stored as euint32.
        // For this example, let's assume we have two euint32 values to decrypt:
        // - totalApprovedProposalsEncrypted
        // - totalFundingAmountEncrypted
        // These would need to be computed in a separate FHE aggregation step (not shown for brevity).
        // For this contract, we'll imagine they are stored or passed in.
        // As a placeholder, we'll use dummy encrypted values.
        // In a real scenario, these would be results of FHE computations.

        euint32 memory totalApprovedProposalsEncrypted = FHE.asEuint32(0); // Placeholder
        euint32 memory totalFundingAmountEncrypted = FHE.asEuint32(0); // Placeholder

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = totalApprovedProposalsEncrypted.toBytes32();
        cts[1] = totalFundingAmountEncrypted.toBytes32();

        // 2. Compute State Hash
        bytes32 stateHash = keccak256(abi.encode(cts, address(this)));

        // 3. Request Decryption
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        // 4. Store Context
        decryptionContexts[requestId] = DecryptionContext({ batchId: batchId, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        emit DecryptionRequested(requestId, batchId);
    }

    // 5. Implement Callback
    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        // a. Replay Guard
        if (context.processed) {
            revert ReplayAttempt();
        }

        // b. State Verification
        // Rebuild the cts array from current contract storage in the *exact same order* as in step 1.
        // This is crucial: the state must be identical to when the decryption was requested.
        // For this example, we need to retrieve the *original* encrypted values that were used
        // to form the `cts` array for this `requestId`.
        // This contract doesn't store these intermediate aggregated encrypted values directly for each request,
        // so this part is illustrative of the pattern. A real contract would need to store or recompute them.
        // For this example, we'll assume `context.batchId` is enough to retrieve/recompute them.

        // Placeholder: Recompute/retrieve the original encrypted values for this batchId
        euint32 memory totalApprovedProposalsEncrypted_recomputed = FHE.asEuint32(0); // Placeholder
        euint32 memory totalFundingAmountEncrypted_recomputed = FHE.asEuint32(0); // Placeholder

        bytes32[] memory currentCts = new bytes32[](2);
        currentCts[0] = totalApprovedProposalsEncrypted_recomputed.toBytes32();
        currentCts[1] = totalFundingAmountEncrypted_recomputed.toBytes32();

        bytes32 currentStateHash = keccak256(abi.encode(currentCts, address(this)));
        if (currentStateHash != context.stateHash) {
            revert StateMismatch();
        }

        // c. Proof Verification
        FHE.checkSignatures(requestId, cleartexts, proof);

        // d. Decode & Finalize
        if (cleartexts.length != 2 * 32) { // Expecting 2 uint256 values
            revert InvalidCleartextLength();
        }

        uint256 totalApprovedProposalsCleartext = abi.decode(cleartexts[0:32], (uint256));
        uint256 totalFundingAmountCleartext = abi.decode(cleartexts[32:64], (uint256));

        context.processed = true;
        emit DecryptionCompleted(requestId, context.batchId, totalApprovedProposalsCleartext, totalFundingAmountCleartext);
    }

    // Internal Helper Functions
    function _hashCiphertexts(bytes32[] memory cts) internal view returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 storage self) internal {
        if (!FHE.isInitialized(self)) {
            self = FHE.asEuint32(0);
        }
    }

    function _initIfNeeded(ebool storage self) internal {
        if (!FHE.isInitialized(self)) {
            self = FHE.asEbool(false);
        }
    }

    function _requireInitialized(euint32 storage self) internal view {
        if (!FHE.isInitialized(self)) {
            revert("Ciphertext not initialized");
        }
    }

    function _requireInitialized(ebool storage self) internal view {
        if (!FHE.isInitialized(self)) {
            revert("Ciphertext not initialized");
        }
    }
}