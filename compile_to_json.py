import os
import json
import solcx

SOLC_VERSION = "0.8.20"
print(f"Checking/Installing solc v{SOLC_VERSION}...")

try:
    if SOLC_VERSION not in solcx.get_installed_solc_versions():
        solcx.install_solc(SOLC_VERSION)
    
    contract_path = os.path.join(os.path.dirname(__file__), "contracts", "CertiChainMonad.sol")
    print(f"Compiling contract at {contract_path}...")
    
    compiled_sol = solcx.compile_files(
        [contract_path],
        output_values=["abi", "bin"],
        solc_version=SOLC_VERSION
    )
    
    contract_key = f"{contract_path}:CertiChainMonad"
    if contract_key not in compiled_sol:
        contract_key = [k for k in compiled_sol.keys() if "CertiChainMonad" in k][0]
        
    contract_interface = compiled_sol[contract_key]
    
    output_path = os.path.join(os.path.dirname(__file__), "contracts", "CertiChainMonad.json")
    with open(output_path, "w") as f:
        json.dump({
            "abi": contract_interface['abi'],
            "bytecode": contract_interface['bin']
        }, f, indent=2)
        
    print(f"🎉 Success! ABI and Bytecode saved to {output_path}")
except Exception as e:
    print(f"❌ Error during compilation: {e}")
