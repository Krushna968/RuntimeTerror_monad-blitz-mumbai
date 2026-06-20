import os
import hashlib
import json
from dotenv import load_dotenv, set_key
from web3 import Web3

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path, override=True)

# Network Configurations
MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz/")
CONTRACT_ADDRESS = os.getenv("MONAD_CONTRACT_ADDRESS")
PRIVATE_KEY = os.getenv("MONAD_PRIVATE_KEY")

# Smart Contract ABI (defined statically so no external JSON is required)
CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"indexed": True, "internalType": "bytes32", "name": "docHash", "type": "bytes32"},
            {"indexed": True, "internalType": "address", "name": "recipientWallet", "type": "address"},
            {"indexed": False, "internalType": "string", "name": "recipientName", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "institutionName", "type": "string"},
            {"indexed": False, "internalType": "uint8", "name": "trustScore", "type": "uint8"}
        ],
        "name": "CertificateRegistered",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "tokenId", "type": "uint256"},
            {"indexed": True, "internalType": "bytes32", "name": "docHash", "type": "bytes32"}
        ],
        "name": "CertificateRevoked",
        "type": "event"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "name": "certificates",
        "outputs": [
            {"internalType": "bytes32", "name": "docHash", "type": "bytes32"},
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
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "docHash", "type": "bytes32"}
        ],
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
    },
    {
        "inputs": [
            {"internalType": "address", "name": "wallet", "type": "address"}
        ],
        "name": "getCertificatesByWallet",
        "outputs": [
            {"internalType": "uint256[]", "name": "", "type": "uint256[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"}
        ],
        "name": "hashToTokenId",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {"internalType": "string", "name": "", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {"internalType": "address", "name": "", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipientWallet", "type": "address"},
            {"internalType": "bytes32", "name": "docHash", "type": "bytes32"},
            {"internalType": "string", "name": "recipientName", "type": "string"},
            {"internalType": "string", "name": "institutionName", "type": "string"},
            {"internalType": "uint256", "name": "issueDate", "type": "uint256"},
            {"internalType": "uint8", "name": "trustScore", "type": "uint8"},
            {"internalType": "string", "name": "verificationLink", "type": "string"}
        ],
        "name": "registerCertificate",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "tokenId", "type": "uint256"}
        ],
        "name": "revokeCertificate",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {"internalType": "string", "name": "", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalCertificates",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "newOwner", "type": "address"}
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "", "type": "address"},
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "name": "walletToTokenIds",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]


def get_web3():
    """Initializes and returns a Web3 connection."""
    w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to Monad network at {MONAD_RPC_URL}")
    return w3


def calculate_file_hash(file_path: str) -> str:
    """Calculates the SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def is_valid_address(addr: str) -> bool:
    if not addr:
        return False
    addr = addr.strip().strip("'").strip('"')
    if not addr.startswith("0x") or len(addr) != 42:
        return False
    try:
        int(addr, 16)
        return True
    except ValueError:
        return False


def is_valid_private_key(key: str) -> bool:
    if not key:
        return False
    key = key.strip().strip("'").strip('"')
    if key.startswith("0x"):
        return len(key) == 66
    return len(key) == 64


def check_on_chain(file_path: str) -> dict:
    """
    Checks if a certificate file is already registered on Monad.
    Returns the certificate details if registered, otherwise None.
    """
    global CONTRACT_ADDRESS
    # Reload env variable to ensure we pick up fresh changes
    load_dotenv(dotenv_path, override=True)
    CONTRACT_ADDRESS = os.getenv("MONAD_CONTRACT_ADDRESS")
    if CONTRACT_ADDRESS:
        CONTRACT_ADDRESS = CONTRACT_ADDRESS.strip().strip("'").strip('"')

    if not is_valid_address(CONTRACT_ADDRESS):
        print(f"Skipping blockchain read check: MONAD_CONTRACT_ADDRESS '{CONTRACT_ADDRESS}' is not a valid address.")
        return None

    try:
        w3 = get_web3()
        # Ensure address checksum
        checksum_address = w3.to_checksum_address(CONTRACT_ADDRESS)
        contract = w3.eth.contract(address=checksum_address, abi=CONTRACT_ABI)
        
        file_hash_hex = calculate_file_hash(file_path)
        file_hash_bytes = bytes.fromhex(file_hash_hex)
        
        # Check mapping first to prevent revert if unregistered
        token_id = contract.functions.hashToTokenId(file_hash_bytes).call()
        if token_id == 0:
            return None

        # Fetch full certificate info
        cert_data = contract.functions.getCertificateByHash(file_hash_bytes).call()
        
        return {
            "tokenId": cert_data[0],
            "recipientName": cert_data[1],
            "institutionName": cert_data[2],
            "issueDate": cert_data[3],
            "trustScore": cert_data[4],
            "verificationLink": cert_data[5],
            "isValid": cert_data[6],
            "recipientWallet": cert_data[7],
            "fileHash": file_hash_hex
        }
    except Exception as e:
        print(f"Blockchain query failed: {e}")
        return None


def register_on_chain(
    file_path: str,
    recipient_wallet: str,
    recipient_name: str,
    institution_name: str,
    issue_date_timestamp: int,
    trust_score: int,
    verification_link: str
) -> dict:
    """
    Registers a new certificate on the Monad testnet blockchain.
    """
    global CONTRACT_ADDRESS, PRIVATE_KEY
    load_dotenv(dotenv_path, override=True)
    CONTRACT_ADDRESS = os.getenv("MONAD_CONTRACT_ADDRESS")
    PRIVATE_KEY = os.getenv("MONAD_PRIVATE_KEY")
    if CONTRACT_ADDRESS:
        CONTRACT_ADDRESS = CONTRACT_ADDRESS.strip().strip("'").strip('"')
    if PRIVATE_KEY:
        PRIVATE_KEY = PRIVATE_KEY.strip().strip("'").strip('"')

    if not is_valid_address(CONTRACT_ADDRESS):
        raise ValueError(f"MONAD_CONTRACT_ADDRESS '{CONTRACT_ADDRESS}' is invalid. Please deploy the contract first or set a valid address in .env.")
    if not PRIVATE_KEY or PRIVATE_KEY.strip() == "":
        raise ValueError("MONAD_PRIVATE_KEY is not set in .env. Please configure it to register certificates.")
    if is_valid_address(PRIVATE_KEY):
        raise ValueError("MONAD_PRIVATE_KEY in .env is configured as a public address (starts with 0x and is 42 chars long) instead of a private key. Please check your config.")
    if not is_valid_private_key(PRIVATE_KEY):
        raise ValueError("MONAD_PRIVATE_KEY in .env is invalid (must be 32-bytes hex). Please check your config.")

    w3 = get_web3()
    checksum_address = w3.to_checksum_address(CONTRACT_ADDRESS)
    contract = w3.eth.contract(address=checksum_address, abi=CONTRACT_ABI)

    # Prepare transaction details
    account = w3.eth.account.from_key(PRIVATE_KEY)
    sender_address = account.address

    file_hash_hex = calculate_file_hash(file_path)
    file_hash_bytes = bytes.fromhex(file_hash_hex)

    # Clean wallet address
    if not recipient_wallet or recipient_wallet.strip() == "":
        recipient_address = sender_address # Fallback to sender
    else:
        recipient_address = w3.to_checksum_address(recipient_wallet.strip())

    # Build transaction
    nonce = w3.eth.get_transaction_count(sender_address)
    
    # Estimate gas or use default limit
    tx_args = {
        'from': sender_address,
        'nonce': nonce,
        'gasPrice': w3.eth.gas_price
    }
    
    transaction = contract.functions.registerCertificate(
        recipient_address,
        file_hash_bytes,
        recipient_name,
        institution_name,
        int(issue_date_timestamp),
        int(trust_score),
        verification_link
    ).build_transaction(tx_args)

    # Sign transaction
    signed_txn = w3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)
    
    # Send transaction
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
    
    # Wait for receipt
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    return {
        "txHash": tx_hash.hex(),
        "status": tx_receipt.status,
        "blockNumber": tx_receipt.blockNumber,
        "fileHash": file_hash_hex
    }
