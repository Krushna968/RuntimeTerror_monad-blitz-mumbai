"""
app.py
--------
Streamlit frontend for CertiChain AI with Monad Testnet Integration.
Allows both AI-powered certificate verification (multi-agent graph on Groq) 
and instant, immutable, trustless on-chain verification & registration on Monad.
"""

import os
import tempfile
import time
from datetime import datetime
import streamlit as st
from dotenv import load_dotenv, set_key

from ingest import extract_text, extract_qr_data
from graph.workflow import build_graph
from blockchain import check_on_chain, register_on_chain, calculate_file_hash, CONTRACT_ABI, get_web3

# Load env file
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# Set page config
st.set_page_config(
    page_title="CertiChain AI | Monad",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling for Monad Branding (Purple / Magenta / Dark Glassmorphism)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Grotesk:wght@400;700&display=swap');
    
    /* Global styling */
    html, body, [data-testid="stAppViewContainer"] {
        font-family: 'Outfit', sans-serif;
        background-color: #0c0b14;
        color: #f3f3f6;
    }
    
    /* Sidebar styling */
    [data-testid="stSidebar"] {
        background-color: #121020;
        border-right: 1px solid #231f42;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        color: #ffffff;
    }
    
    /* Custom Gradient Title */
    .title-container {
        padding: 1.5rem 0rem;
        text-align: center;
        background: linear-gradient(135deg, #a000ff 0%, #836efd 50%, #ff007a 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    /* Verified Badge Card */
    .verified-card {
        background: linear-gradient(135deg, rgba(38, 20, 74, 0.6) 0%, rgba(13, 27, 42, 0.6) 100%);
        border: 2px solid #836efd;
        border-radius: 16px;
        padding: 24px;
        margin: 20px 0px;
        box-shadow: 0 8px 32px 0 rgba(131, 110, 253, 0.2);
        backdrop-filter: blur(8px);
    }
    
    .verified-header {
        color: #00ffcc;
        font-size: 24px;
        font-weight: 800;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
    }
    
    /* Fraud Badge Card */
    .fraud-card {
        background: linear-gradient(135deg, rgba(74, 20, 20, 0.6) 0%, rgba(13, 27, 42, 0.6) 100%);
        border: 2px solid #ff007a;
        border-radius: 16px;
        padding: 24px;
        margin: 20px 0px;
        box-shadow: 0 8px 32px 0 rgba(255, 0, 122, 0.2);
        backdrop-filter: blur(8px);
    }
    
    .fraud-header {
        color: #ff3366;
        font-size: 24px;
        font-weight: 800;
        margin-bottom: 12px;
    }

    /* Info Card */
    .info-card {
        background: rgba(30, 28, 45, 0.4);
        border: 1px solid #2d294d;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 15px;
    }
    
    /* Buttons */
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(131, 110, 253, 0.4);
    }
</style>
""", unsafe_allow_html=True)

# Helper function to update .env key instantly in memory and disk
def update_env_variable(key, value):
    set_key(dotenv_path, key, value)
    os.environ[key] = value

# Title
st.markdown("<h1 class='title-container' style='font-size: 3.2rem;'>🛡️ CertiChain AI</h1>", unsafe_allow_html=True)
st.markdown("<p style='text-align: center; font-size: 1.2rem; color: #a5a2c2; margin-top: -15px;'>Explainable Certificate Authentication powered by Multi-Agent AI & Monad Blockchain</p>", unsafe_allow_html=True)
st.write("---")

# Initialize Session State
if "graph" not in st.session_state:
    st.session_state.graph = build_graph()
if "last_processed" not in st.session_state:
    st.session_state.last_processed = None
if "blockchain_tx" not in st.session_state:
    st.session_state.blockchain_tx = None

# Sidebar Configuration
st.sidebar.markdown("<h2 style='text-align: center; color: #836efd;'>⛓️ Monad Testnet Settings</h2>", unsafe_allow_html=True)

# Display network connection info
try:
    w3_conn = get_web3()
    st.sidebar.success("🟢 Connected to Monad Testnet")
except Exception:
    st.sidebar.error("🔴 Connected: Offline/Failover")

# Private key management in UI
env_private_key = os.getenv("MONAD_PRIVATE_KEY", "")
input_private_key = st.sidebar.text_input(
    "Monad Wallet Private Key",
    value=env_private_key,
    type="password",
    help="Required to deploy the smart contract and write/register certificate SBTs on the ledger."
)

if input_private_key != env_private_key:
    update_env_variable("MONAD_PRIVATE_KEY", input_private_key)
    st.sidebar.info("Saved private key to .env!")

# Contract address management in UI
env_contract_address = os.getenv("MONAD_CONTRACT_ADDRESS", "")
input_contract = st.sidebar.text_input(
    "Registry Contract Address",
    value=env_contract_address,
    placeholder="0x..."
)

if input_contract != env_contract_address:
    update_env_variable("MONAD_CONTRACT_ADDRESS", input_contract)
    st.sidebar.info("Updated contract address!")

# 1-Click deploy button in Sidebar
if not input_contract or input_contract.strip() == "":
    st.sidebar.warning("No smart contract deployed yet.")
    if input_private_key:
        if st.sidebar.button("Deploy CertiChain Registry", type="primary", use_container_width=True):
            with st.sidebar.spinner("Compiling and deploying to Monad Testnet..."):
                try:
                    # Import and execute deployment logic
                    from deploy import Web3, account
                    w3 = Web3(Web3.HTTPProvider(os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz/")))
                    
                    # Try loading compiled JSON
                    json_path = os.path.join(os.path.dirname(__file__), "contracts", "CertiChainMonad.json")
                    if os.path.exists(json_path):
                        with open(json_path, "r") as f:
                            contract_data = json.load(f)
                            abi = contract_data["abi"]
                            bytecode = contract_data["bytecode"]
                    else:
                        raise FileNotFoundError("Pre-compiled contract JSON not found. Please compile the contract.")
                    
                    # Deploy
                    CertiChainContract = w3.eth.contract(abi=abi, bytecode=bytecode)
                    nonce = w3.eth.get_transaction_count(account.address)
                    transaction = CertiChainContract.constructor().build_transaction({
                        'from': account.address,
                        'nonce': nonce,
                        'gasPrice': w3.eth.gas_price
                    })
                    signed_txn = w3.eth.account.sign_transaction(transaction, private_key=input_private_key)
                    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
                    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
                    
                    new_addr = tx_receipt.contractAddress
                    update_env_variable("MONAD_CONTRACT_ADDRESS", new_addr)
                    st.sidebar.success(f"Deployed: {new_addr}")
                    st.rerun()
                except Exception as e:
                    st.sidebar.error(f"Deployment failed: {e}")
    else:
        st.sidebar.info("Set private key to enable 1-click contract deployment.")
else:
    st.sidebar.info(f"Deployed Registry Contract: `{input_contract[:6]}...{input_contract[-4:]}`")
    st.sidebar.markdown(f"[View Contract on Explorer](https://testnet.monadscan.com/address/{input_contract})")

# Main Content Area
col1, col2 = st.columns([1, 1])

with col1:
    st.markdown("### 1. Upload Certificate")
    uploaded_file = st.file_uploader(
        "Supported formats: PDF, JPG, PNG",
        type=["pdf", "jpg", "jpeg", "png"]
    )
    
    if uploaded_file is not None:
        # Save file to temporary path
        suffix = os.path.splitext(uploaded_file.name)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.getvalue())
            tmp_path = tmp.name
        
        # Calculate file hash
        file_hash = calculate_file_hash(tmp_path)
        st.info(f"📄 SHA-256 Certificate Hash: `{file_hash}`")
        
        # Check Monad Ledger First
        on_chain_record = None
        if input_contract:
            with st.spinner("Checking Monad Testnet for on-chain records..."):
                on_chain_record = check_on_chain(tmp_path)
        
        if on_chain_record:
            st.markdown(f"""
            <div class='verified-card'>
                <div class='verified-header'>🛡️ MONAD ON-CHAIN VERIFIED</div>
                <p>This certificate hash has been verified and registered immutably on the <b>Monad Blockchain</b>.</p>
                <hr style='border-color: #836efd;'>
                <table style='width:100%; font-size:15px; color:#f3f3f6;'>
                    <tr><td><b>Token ID / Certificate No:</b></td><td>SBT #{on_chain_record['tokenId']}</td></tr>
                    <tr><td><b>Recipient Name:</b></td><td>{on_chain_record['recipientName']}</td></tr>
                    <tr><td><b>Issuing Institution:</b></td><td>{on_chain_record['institutionName']}</td></tr>
                    <tr><td><b>Issue Date:</b></td><td>{datetime.fromtimestamp(on_chain_record['issueDate']).strftime('%Y-%m-%d')}</td></tr>
                    <tr><td><b>Trust Score:</b></td><td><span style='color:#00ffcc; font-weight:bold;'>{on_chain_record['trustScore']}%</span></td></tr>
                    <tr><td><b>Recipient Wallet:</b></td><td><code>{on_chain_record['recipientWallet']}</code></td></tr>
                </table>
            </div>
            """, unsafe_allow_html=True)
            
            if on_chain_record['verificationLink']:
                st.markdown(f"[Official Verification Portal]({on_chain_record['verificationLink']})")
                
            st.markdown(f"[View Token Registry on Monadscan](https://testnet.monadscan.com/address/{input_contract})")
            
            # Allow force re-run
            force_run = st.checkbox("Re-run AI verification graph anyway?")
            if not force_run:
                os.unlink(tmp_path)
                st.stop()
        else:
            if input_contract:
                st.warning("⚠️ No matching certificate hash registered on the Monad Blockchain registry.")
            else:
                st.warning("🔗 Monad query skipped (no contract address configured).")
        
        # Run AI Verification Graph
        if st.button("Run Multi-Agent AI Authenticator", type="primary", use_container_width=True):
            with st.spinner("Step 1: Running OCR & QR Scan..."):
                raw_text = extract_text(tmp_path)
                qr_data = extract_qr_data(tmp_path)
                
            with st.spinner("Step 2: Executing Multi-Agent authentication graph on Groq..."):
                final_state = st.session_state.graph.invoke(
                    {
                        "file_path": tmp_path,
                        "raw_text": raw_text,
                        "qr_data": qr_data,
                    }
                )
            
            # Save state
            st.session_state.last_processed = {
                "final_state": final_state,
                "tmp_path": tmp_path,
                "file_hash": file_hash
            }
            
            # Clean up immediately if we're not using the file later
            # (But we need the file for registration, so we delete it on rerun or completion)
            
        # Display Agent Reports
        if st.session_state.last_processed:
            last_proc = st.session_state.last_processed
            state = last_proc["final_state"]
            
            st.markdown("### 2. Multi-Agent Analysis Report")
            
            # Agent 1 Expander
            with st.expander("Agent 1 — Document Classifier Output"):
                st.json(state.get("detection_result", {}))
                
            if state.get("stopped_early"):
                st.markdown("""
                <div class='fraud-card'>
                    <div class='fraud-header'>❌ Rejected by Classifier</div>
                    <p>The uploaded document was classified as NOT a valid certificate.</p>
                </div>
                """, unsafe_allow_html=True)
            else:
                # Agent 2 & 3 Expanders
                with st.expander("Agent 2 — Key Information Extraction"):
                    st.json(state.get("extracted_data", {}))
                    
                with st.expander("Agent 3 — Live Cross-Reference & Trust Scorer"):
                    st.json(state.get("auth_result", {}))
                
                # Final explainable output
                explanation = state.get("explanation", "")
                st.markdown("### Final System Report")
                
                if "FRAUD DETECTED" in explanation:
                    st.markdown(f"<div class='fraud-card'><div class='fraud-header'>⚠️ FRAUD DETECTED</div>{explanation.replace('Certificate Status: FRAUD DETECTED', '')}</div>", unsafe_allow_html=True)
                else:
                    st.markdown(f"<div class='verified-card'><div class='verified-header'>🛡️ VERIFIED GENUINE</div>{explanation.replace('Certificate Status: VERIFIED', '')}</div>", unsafe_allow_html=True)

                    # --- MONAD TESTNET REGISTRATION SECTION ---
                    st.write("---")
                    st.markdown("### ⛓️ Register Certificate on Monad Testnet")
                    st.write("Secure this certificate's integrity forever by minting a non-transferable Soulbound Token (SBT) credential record.")
                    
                    if not input_contract or not input_private_key:
                        st.info("💡 Set your Monad contract address and private key in the sidebar to register this verified certificate on-chain.")
                    else:
                        recipient_w = st.text_input("Recipient Wallet Address (Optional)", placeholder="0x...")
                        
                        if st.button("Mint Certificate SBT on Monad", type="primary"):
                            with st.spinner("Minting SBT on Monad Testnet (Instant parallel execution)..."):
                                try:
                                    ext_data = state.get("extracted_data", {})
                                    auth_res = state.get("auth_result", {})
                                    
                                    # Extract values
                                    candidate = ext_data.get("candidate_name", "Unknown Recipient")
                                    institution = ext_data.get("institution_name", "Unknown Institution")
                                    
                                    # Safe date parsing
                                    issue_date_str = ext_data.get("issue_date", "")
                                    try:
                                        # Simple fallback parser
                                        dt = datetime.strptime(issue_date_str, "%Y-%m-%d")
                                        timestamp = int(dt.timestamp())
                                    except Exception:
                                        timestamp = int(time.time())
                                        
                                    trust_score = auth_res.get("trust_score", 100)
                                    v_link = auth_res.get("verification_link", "")
                                    
                                    # Send register transaction
                                    tx_info = register_on_chain(
                                        file_path=last_proc["tmp_path"],
                                        recipient_wallet=recipient_w,
                                        recipient_name=candidate,
                                        institution_name=institution,
                                        issue_date_timestamp=timestamp,
                                        trust_score=trust_score,
                                        verification_link=v_link
                                    )
                                    
                                    st.success("🎉 Success! Certificate registered on the Monad ledger.")
                                    st.markdown(f"""
                                    - **Transaction Hash:** `{tx_info['txHash']}`
                                    - **Block Number:** `{tx_info['blockNumber']}`
                                    - [View Transaction on Monadscan](https://testnet.monadscan.com/tx/{tx_info['txHash']})
                                    """)
                                    
                                    # Clear processed state to trigger refresh next time
                                    st.session_state.last_processed = None
                                    if os.path.exists(tmp_path):
                                        os.unlink(tmp_path)
                                        
                                    time.sleep(3)
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"Failed to register on-chain: {e}")
                                    
        # Clean up temp file on script finish if not processed/running
        if uploaded_file is None and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            
with col2:
    st.markdown("### Certificate Preview & Network Overview")
    if uploaded_file is not None:
        if uploaded_file.type.startswith("image/"):
            st.image(uploaded_file, caption="Uploaded Certificate", use_container_width=True)
        else:
            st.info("PDF document uploaded. Preview is only available for images, but PDF text extraction and verification are fully supported.")
    else:
        st.markdown("""
        <div class='info-card'>
            <h4>Why Monad?</h4>
            <p>Monad is a high-performance EVM-compatible Layer 1 blockchain. CertiChain AI leverages Monad's main advantages:</p>
            <ul>
                <li><b>Ultra-Fast Verification:</b> Block times of 1 second and sub-second finality allow instant checks of certificate hashes on-chain.</li>
                <li><b>Negligible Fees:</b> Recording credentials as non-transferable Soulbound Tokens costs a fraction of a cent.</li>
                <li><b>Parallel Execution:</b> Scale to millions of credential verifications without network congestion or fee spikes.</li>
            </ul>
        </div>
        
        <div class='info-card'>
            <h4>Getting Started Flow</h4>
            <ol>
                <li>Input your <b>Monad Private Key</b> in the sidebar (get test MON from the faucet).</li>
                <li>If not yet deployed, click <b>Deploy CertiChain Registry</b> to deploy your own registry contract.</li>
                <li>Upload any certificate file.</li>
                <li>The system checks the blockchain: if it is already verified, it instantly shows <b>Verified</b>.</li>
                <li>If not, run the <b>AI Authenticator</b> to evaluate signatures, seals, institutions, and search data.</li>
                <li>If AI verifies it, click <b>Mint Certificate SBT</b> to store it on-chain forever!</li>
            </ol>
        </div>
        """, unsafe_allow_html=True)
