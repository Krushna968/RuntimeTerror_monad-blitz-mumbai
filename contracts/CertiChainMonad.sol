// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertiChainMonad
 * @dev Registry of certificates implemented as a Soulbound Token (SBT) system on Monad.
 * Because Monad has parallel execution and sub-second finality, registering and
 * verifying certificate hashes is incredibly fast and cheap.
 */
contract CertiChainMonad {
    string public name = "CertiChain Monad SBT Registry";
    string public symbol = "CCHMND";
    address public owner;

    struct Certificate {
        bytes32 docHash;          // SHA-256 hash of certificate PDF/file
        string recipientName;
        string institutionName;
        uint256 issueDate;
        uint8 trustScore;
        string verificationLink;
        bool isValid;
        address recipientWallet;
    }

    uint256 public totalCertificates;
    
    // Mappings
    mapping(uint256 => Certificate) public certificates;
    mapping(bytes32 => uint256) public hashToTokenId;
    mapping(address => uint256[]) public walletToTokenIds;

    event CertificateRegistered(
        uint256 indexed tokenId,
        bytes32 indexed docHash,
        address indexed recipientWallet,
        string recipientName,
        string institutionName,
        uint8 trustScore
    );

    event CertificateRevoked(uint256 indexed tokenId, bytes32 indexed docHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    /**
     * @dev Register a certificate on the Monad ledger.
     * Mints it conceptually as a Soulbound Token (SBT) to the recipient.
     */
    function registerCertificate(
        address recipientWallet,
        bytes32 docHash,
        string calldata recipientName,
        string calldata institutionName,
        uint256 issueDate,
        uint8 trustScore,
        string calldata verificationLink
    ) external onlyOwner returns (uint256) {
        require(docHash != bytes32(0), "Invalid doc hash");
        require(hashToTokenId[docHash] == 0, "Certificate already registered");

        totalCertificates++;
        uint256 tokenId = totalCertificates;

        certificates[tokenId] = Certificate({
            docHash: docHash,
            recipientName: recipientName,
            institutionName: institutionName,
            issueDate: issueDate,
            trustScore: trustScore,
            verificationLink: verificationLink,
            isValid: true,
            recipientWallet: recipientWallet
        });

        hashToTokenId[docHash] = tokenId;
        walletToTokenIds[recipientWallet].push(tokenId);

        emit CertificateRegistered(
            tokenId,
            docHash,
            recipientWallet,
            recipientName,
            institutionName,
            trustScore
        );

        return tokenId;
    }

    /**
     * @dev Revoke a certificate
     */
    function revokeCertificate(uint256 tokenId) external onlyOwner {
        require(tokenId > 0 && tokenId <= totalCertificates, "Invalid token ID");
        Certificate storage cert = certificates[tokenId];
        require(cert.isValid, "Certificate already revoked");
        cert.isValid = false;
        emit CertificateRevoked(tokenId, cert.docHash);
    }

    /**
     * @dev Check if a certificate hash is registered and valid
     */
    function getCertificateByHash(bytes32 docHash) external view returns (
        uint256 tokenId,
        string memory recipientName,
        string memory institutionName,
        uint256 issueDate,
        uint8 trustScore,
        string memory verificationLink,
        bool isValid,
        address recipientWallet
    ) {
        uint256 id = hashToTokenId[docHash];
        require(id != 0, "Certificate hash not registered");
        Certificate memory cert = certificates[id];
        return (
            id,
            cert.recipientName,
            cert.institutionName,
            cert.issueDate,
            cert.trustScore,
            cert.verificationLink,
            cert.isValid,
            cert.recipientWallet
        );
    }

    /**
     * @dev Get certificate IDs owned by a wallet
     */
    function getCertificatesByWallet(address wallet) external view returns (uint256[] memory) {
        return walletToTokenIds[wallet];
    }
}
