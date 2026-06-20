import os
import sys
import json
import solcx
from dotenv import load_dotenv, set_key
from web3 import Web3

# Load env file
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz/")
PRIVATE_KEY = os.getenv("MONAD_PRIVATE_KEY")

if not PRIVATE_KEY or PRIVATE_KEY.strip() == "":
    print("ERROR: MONAD_PRIVATE_KEY is not set in your .env file!")
    print("Please add your Monad Testnet private key to .env before running this script.")
    sys.exit(1)

# Ensure Solidity compiler is installed
SOLC_VERSION = "0.8.20"
abi = None
bytecode = None

print(f"Checking for solc v{SOLC_VERSION}...")
try:
    if SOLC_VERSION not in solcx.get_installed_solc_versions():
        print(f"Installing solc v{SOLC_VERSION}... This might take a few moments.")
        solcx.install_solc(SOLC_VERSION)
    print("solc compiler ready.")
    
    # Compile contract
    contract_path = os.path.join(os.path.dirname(__file__), "contracts", "CertiChainMonad.sol")
    if os.path.exists(contract_path):
        print("Compiling contract...")
        compiled_sol = solcx.compile_files(
            [contract_path],
            output_values=["abi", "bin"],
            solc_version=SOLC_VERSION
        )
        
        contract_key = f"{contract_path}:CertiChainMonad"
        if contract_key not in compiled_sol:
            contract_key = [k for k in compiled_sol.keys() if "CertiChainMonad" in k][0]

        contract_interface = compiled_sol[contract_key]
        abi = contract_interface['abi']
        bytecode = contract_interface['bin']
        print("Compilation successful.")
except Exception as e:
    print(f"Compilation via solcx failed or skipped: {e}")
    print("Attempting to load from pre-compiled JSON file...")

# Fallback: Load from JSON if compilation failed or was skipped
if not abi or not bytecode:
    json_path = os.path.join(os.path.dirname(__file__), "contracts", "CertiChainMonad.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r") as f:
                data = json.load(f)
                abi = data["abi"]
                bytecode = data["bytecode"]
                print("Loaded ABI and Bytecode from pre-compiled JSON successfully.")
        except Exception as err:
            print(f"ERROR: Failed to load pre-compiled JSON: {err}")
            sys.exit(1)
    else:
        print("ERROR: No pre-compiled JSON found and compilation failed.")
        sys.exit(1)

# Connect to Monad
print(f"Connecting to Monad Testnet at {MONAD_RPC_URL}...")
w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))
if not w3.is_connected():
    print("ERROR: Failed to connect to Monad network!")
    sys.exit(1)

# Setup deployer account
account = w3.eth.account.from_key(PRIVATE_KEY)
deployer_address = account.address
print(f"Deployer address: {deployer_address}")

# Check balance
balance = w3.eth.get_balance(deployer_address)
balance_in_mon = w3.from_wei(balance, 'ether')
print(f"Deployer balance: {balance_in_mon} MON")

if balance == 0:
    print("ERROR: Deployer account has 0 MON. Please request testnet tokens from https://faucet.monad.xyz")
    sys.exit(1)

# Build deployment transaction
print("Deploying contract to Monad Testnet...")
CertiChainContract = w3.eth.contract(abi=abi, bytecode=bytecode)

nonce = w3.eth.get_transaction_count(deployer_address)
gas_price = w3.eth.gas_price

transaction = CertiChainContract.constructor().build_transaction({
    'from': deployer_address,
    'nonce': nonce,
    'gasPrice': gas_price
})

# Sign transaction
signed_txn = w3.eth.account.sign_transaction(transaction, private_key=PRIVATE_KEY)

# Send transaction
tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
print(f"Transaction sent. Hash: {tx_hash.hex()}")
print("Waiting for transaction receipt (finality on Monad is sub-second, but we wait)...")

tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
contract_address = tx_receipt.contractAddress
print(f"SUCCESS: Contract deployed successfully to Monad Testnet!")
print(f"Contract Address: {contract_address}")
print(f"Block Number: {tx_receipt.blockNumber}")
print(f"Explorer link: https://testnet.monadscan.com/address/{contract_address}")

# Save to .env
set_key(dotenv_path, "MONAD_CONTRACT_ADDRESS", contract_address)
print("Updated .env with MONAD_CONTRACT_ADDRESS.")
