"""
Wallet Management Kit — Mock API endpoints.

EXACT URLs, methods, and JSON structures from the Wallet Management KIT documentation.
All endpoints return mock data; no real backend is called.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Query, Request

from mocks.wallet_mock import WalletMockState

router = APIRouter()


# ===================================================================
# 4.1  Creating a wallet
# ===================================================================

@router.post("/wallet")
async def wallet_create(state: str = Query(...), request: Request = None):
    body = await _json_body(request)

    if state == "precreate":
        return {
            "result": {
                "activityArea": None,
                "addressLine1": body.get("clientAddress", ""),
                "addressLine2": None,
                "addressLine3": None,
                "addressLine4": None,
                "agenceId": "211",
                "averageIncome": None,
                "birthDay": None,
                "channelId": "P",
                "city": None,
                "country": None,
                "dateOfBirth": body.get("dateOfBirth", ""),
                "distributeurId": "000104",
                "documentExpiryDate1": None,
                "documentExpiryDate2": None,
                "documentScan1": "",
                "documentScan2": "",
                "documentType1": "",
                "documentType2": None,
                "email": body.get("email", ""),
                "familyStatus": None,
                "firstName": body.get("clientFirstName", ""),
                "fonction": None,
                "gender": body.get("gender", ""),
                "institutionId": "0001",
                "landLineNumber": None,
                "lastName": body.get("clientLastName", ""),
                "legalId1": body.get("legalId", ""),
                "legalId2": None,
                "level": None,
                "mailaddress": None,
                "mobileNumber": body.get("phoneNumber", ""),
                "nationalite": None,
                "numberofchildren": None,
                "optField1": None,
                "optField2": None,
                "otp": "123456",
                "phoneNumber": None,
                "placeOfBirth": body.get("placeOfBirth", ""),
                "postCode": None,
                "productId": "000",
                "productTypeId": "000",
                "profession": None,
                "provider": body.get("phoneOperator", "IAM"),
                "raisonSocial": None,
                "region": None,
                "registrationDate": None,
                "title": None,
                "token": WalletMockState.random_token(),
            }
        }

    if state == "activate":
        return {
            "result": {
                "contractId": WalletMockState.contract_id(),
                "reference": "",
                "level": "000",
                "rib": "853780241716465970216211",
            }
        }

    return {"error": "Invalid state. Use 'precreate' or 'activate'."}, 400


# ===================================================================
# 4.2  Consulting customer information
# ===================================================================

@router.post("/wallet/clientinfo")
async def wallet_clientinfo(request: Request):
    body = await _json_body(request)
    return {
        "result": {
            "adressLine1": " ",
            "city": "Casablanca",
            "contractId": None,
            "country": "MAR",
            "description": None,
            "email": "",
            "numberOfChildren": None,
            "phoneNumber": body.get("phoneNumber", WalletMockState.phone_number()),
            "pidNUmber": None,
            "pidType": body.get("identificationType", "CIN"),
            "products": [
                {
                    "abbreviation": None,
                    "contractId": WalletMockState.contract_id(),
                    "description": None,
                    "email": "",
                    "level": "000",
                    "name": "CDP BASIC",
                    "phoneNumber": body.get("phoneNumber", WalletMockState.phone_number()),
                    "productTypeId": "000",
                    "productTypeName": "PARTICULIER",
                    "provider": "IAM",
                    "rib": "853455230818452878570832",
                    "solde": f"{WalletMockState.get_balance():.2f}",
                    "statusId": "1",
                    "tierType": "03",
                    "uid": "000",
                }
            ],
            "radical": "",
            "soldeCumule": f"{WalletMockState.get_balance():.2f}",
            "statusId": None,
            "tierFirstName": "Prenom",
            "tierId": "TR2334600322963601",
            "tierLastName": "Nom",
            "userName": None,
            "familyStatus": None,
        }
    }


# ===================================================================
# 4.3  Transaction history
# ===================================================================

@router.get("/wallet/operations")
async def wallet_operations(contractid: str = Query(...)):
    txs = WalletMockState.get_transactions(limit=20)
    if not txs:
        txs = [
            {
                "amount": "10.00",
                "Fees": "0",
                "beneficiaryFirstName": "Prenom",
                "beneficiaryLastName": "nom",
                "beneficiaryRIB": None,
                "clientNote": "W2W",
                "contractId": None,
                "currency": "MAD",
                "date": WalletMockState.now_str(),
                "dateToCompare": "0001-01-01T00:00:00Z",
                "frais": [],
                "numTel": None,
                "operation": None,
                "referenceId": WalletMockState.next_reference_id(),
                "sign": None,
                "srcDestNumber": "212755123456",
                "status": "000",
                "totalAmount": "10.00",
                "totalFrai": "0.00",
                "type": "MMD",
                "isCanceled": False,
                "isTierCashIn": False,
            }
        ]
    return {"result": txs}


# ===================================================================
# 4.4  Balance consultation
# ===================================================================

@router.get("/wallet/balance")
async def wallet_balance(contractid: str = Query(...)):
    return {
        "result": {
            "balance": [
                {"value": f"{WalletMockState.get_balance():.2f}".replace(".", ",")}
            ]
        }
    }


# ===================================================================
# 4.5  Cash IN
# ===================================================================

@router.post("/wallet/cash/in")
async def wallet_cash_in(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("amount", 0))

    if step == "simulation":
        token = WalletMockState.random_token()
        return {
            "result": {
                "Fees": "0.0",
                "feeDetail": "[Nature:\"COM\",InvariantFee:0.000,VariantFee:0.0000000]",
                "token": token,
                "amountToCollect": amount,
                "isTier": True,
                "cardId": body.get("contractId", WalletMockState.contract_id()),
                "transactionId": WalletMockState.next_reference_id(),
                "benFirstName": "Client",
                "benLastName": "",
            }
        }

    if step == "confirmation":
        WalletMockState.credit(amount)
        return {
            "result": {
                "Fees": "0.0",
                "feeDetails": None,
                "token": body.get("token", ""),
                "amount": amount,
                "transactionReference": WalletMockState.next_reference_id(),
                "optFieldOutput1": None,
                "optFieldOutput2": None,
                "cardId": body.get("contractId", WalletMockState.contract_id()),
            }
        }

    return {"error": "Invalid step"}, 400


# ===================================================================
# 4.6  Cash OUT
# ===================================================================

@router.post("/wallet/cash/out")
async def wallet_cash_out(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("amount", 0))

    if step == "simulation":
        return {
            "result": {
                "Fees": "0.0",
                "token": WalletMockState.random_token(),
                "amountToCollect": amount,
                "cashOut_Max": WalletMockState.get_balance(),
                "optFieldOutput1": None,
                "optFieldOutput2": None,
                "cardId": WalletMockState.contract_id(),
                "transactionId": WalletMockState.next_reference_id(),
                "feeDetail": "[Nature:\"COM\",InvariantFee:0.000,VariantFee:0.0000000]",
            }
        }

    if step == "confirmation":
        WalletMockState.debit(amount)
        return {
            "result": {
                "Fees": "0.0",
                "feeDetails": None,
                "token": body.get("token", ""),
                "amount": amount,
                "transactionReference": WalletMockState.next_reference_id(),
                "optFieldOutput1": None,
                "optFieldOutput2": None,
                "cardId": WalletMockState.contract_id(),
            }
        }

    return {"error": "Invalid step"}, 400


@router.post("/wallet/cash/out/otp")
async def wallet_cash_out_otp(request: Request):
    return {"result": [{"codeOtp": WalletMockState.random_otp()}]}


# ===================================================================
# 4.7  Wallet to Wallet
# ===================================================================

@router.post("/wallet/transfer/wallet")
async def wallet_to_wallet(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("amout", body.get("amount", 0)))

    if step == "simulation":
        ref = WalletMockState.next_reference_id()
        return {
            "result": {
                "amount": str(amount),
                "Fees": "0.0",
                "beneficiaryFirstName": "Prenom",
                "beneficiaryLastName": "nom",
                "beneficiaryRIB": None,
                "contractId": None,
                "currency": None,
                "date": None,
                "dateToCompare": "0001-01-01T00:00:00Z",
                "frais": [],
                "numTel": None,
                "operation": None,
                "referenceId": ref,
                "sign": None,
                "srcDestNumber": None,
                "status": None,
                "totalAmount": str(amount),
                "totalFrai": "0.00",
                "type": "TT",
                "isCanceled": False,
                "isTierCashIn": False,
            }
        }

    if step == "confirmation":
        WalletMockState.debit(amount)
        WalletMockState.add_transaction(
            {
                "amount": str(amount),
                "currency": "MAD",
                "date": WalletMockState.now_str(),
                "type": "MMD",
                "srcDestNumber": body.get("destinationPhone", ""),
                "referenceId": WalletMockState.next_reference_id(),
                "status": "000",
                "clientNote": body.get("clentNote", body.get("clientNote", "W2W")),
            }
        )
        return {
            "result": {
                "item1": {
                    "creditAmounts": None,
                    "debitAmounts": None,
                    "depot": None,
                    "retrait": None,
                    "value": f"{WalletMockState.get_balance():.3f}",
                },
                "item2": "000",
                "item3": "Successful",
            }
        }

    return {"error": "Invalid step"}, 400


@router.post("/wallet/transfer/wallet/otp")
async def wallet_to_wallet_otp(request: Request):
    return {"result": [{"codeOtp": WalletMockState.random_otp()}]}


# ===================================================================
# 4.8  Transfer (Virement)
# ===================================================================

@router.post("/wallet/transfer/virement")
async def wallet_virement(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("Amount", 0))

    if step == "simulation":
        return {
            "result": [
                {
                    "frais": "0",
                    "fraisSms": None,
                    "totalAmountWithFee": str(amount),
                    "deviseEmissionCode": None,
                    "fraisInclus": False,
                    "montantDroitTimbre": 0,
                    "montantFrais": 0,
                    "montantFraisSMS": 0,
                    "montantFraisTotal": 0,
                    "montantTVA": 0,
                    "montantTVASMS": 0,
                    "tauxChange": 0,
                }
            ]
        }

    if step == "confirmation":
        WalletMockState.debit(amount)
        WalletMockState.add_transaction(
            {
                "amount": str(amount),
                "currency": "MAD",
                "date": WalletMockState.now_str(),
                "type": "VIR",
                "srcDestNumber": body.get("destinationPhone", ""),
                "referenceId": WalletMockState.next_reference_id(),
                "status": "000",
                "clientNote": body.get("clientNote", "Virement"),
            }
        )
        return {
            "result": {
                "contractId": body.get("ContractId", ""),
                "reference": WalletMockState.next_reference_id(),
            }
        }

    return {"error": "Invalid step"}, 400


@router.post("/wallet/transfer/virement/otp")
async def wallet_virement_otp(request: Request):
    return {"result": WalletMockState.random_otp()}


# ===================================================================
# 4.9  ATM withdrawal
# ===================================================================

@router.post("/wallet/cash/gab/out")
async def wallet_gab_out(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("Amount", 0))

    if step == "simulation":
        return {
            "result": {
                "totalFrai": "3.00",
                "feeDetails": "[Nature:\"COM\",InvariantFee:3.000,VariantFee:0.0000000],"
                "[Nature:\"TVA\",InvariantFee:0.000,VariantFee:0.27]",
                "token": WalletMockState.random_token(),
                "totalAmount": amount + 3.0,
                "referenceId": WalletMockState.next_reference_id(),
            }
        }

    if step == "confirmation":
        WalletMockState.debit(amount + 3.0)
        return {
            "result": {
                "fee": "3.00",
                "feeDetails": None,
                "token": WalletMockState.random_token(),
                "amount": amount,
                "transactionReference": "",
                "cardId": body.get("ContractId", WalletMockState.contract_id()),
                "transactionId": WalletMockState.next_reference_id(),
                "transfertCihExpressReference": "00230110002126023062025",
                "redCode": None,
                "greenCode": None,
            }
        }

    return {"error": "Invalid step"}, 400


@router.post("/wallet/cash/gab/otp")
async def wallet_gab_otp(request: Request):
    return {"result": [{"codeOtp": WalletMockState.random_otp()}]}


# ===================================================================
# 4.10  Wallet to Merchant
# ===================================================================

@router.post("/wallet/Transfer/WalletToMerchant")
async def wallet_to_merchant(step: str = Query(...), request: Request = None):
    body = await _json_body(request)
    amount = float(body.get("Amout", body.get("Amount", 0)))

    if step == "simulation":
        ref = WalletMockState.next_reference_id()
        return {
            "result": {
                "amount": str(amount),
                "beneficiaryFirstName": "Merchant",
                "beneficiaryLastName": "",
                "beneficiaryRIB": None,
                "clientNote": body.get("clientNote", ""),
                "contractId": None,
                "currency": None,
                "date": None,
                "dateToCompare": "0001-01-01T00:00:00Z",
                "frais": [],
                "numTel": None,
                "operation": None,
                "referenceId": ref,
                "sign": None,
                "srcDestNumber": None,
                "status": None,
                "totalAmount": str(amount),
                "totalFrai": "0",
                "type": "TM",
                "isCanceled": False,
                "isTierCashIn": False,
                "feeDetails": None,
                "token": None,
                "optFieldOutput1": None,
                "optFieldOutput2": None,
                "cardId": None,
                "isSwitch": False,
            }
        }

    if step == "confirmation":
        WalletMockState.debit(amount)
        WalletMockState.add_transaction(
            {
                "amount": str(amount),
                "currency": "MAD",
                "date": WalletMockState.now_str(),
                "type": "TM",
                "srcDestNumber": body.get("DestinationPhone", body.get("merchantPhoneNumber", "")),
                "referenceId": WalletMockState.next_reference_id(),
                "status": "000",
                "clientNote": body.get("clientNote", "Achat Atlas Wallet"),
            }
        )
        return {
            "result": {
                "item1": {
                    "creditAmounts": None,
                    "debitAmounts": None,
                    "depot": None,
                    "retrait": None,
                    "value": f"{WalletMockState.get_balance():.3f}",
                    "transactionId": None,
                    "cardId": None,
                    "optFieldOutput2": None,
                    "optFieldOutput1": None,
                    "transactionReference": None,
                    "amount": None,
                    "token": None,
                    "fee": None,
                    "feeDetails": None,
                },
                "item2": "000",
                "item3": "Successful",
            }
        }

    return {"error": "Invalid step"}, 400


@router.post("/wallet/walletToMerchant/cash/out/otp")
async def wallet_to_merchant_otp(request: Request):
    return {"result": [{"codeOtp": WalletMockState.random_otp()}]}


# ===================================================================
# 4.11  Creating a Merchant Wallet
# ===================================================================

@router.post("/merchants")
async def merchant_create(request: Request):
    return {"result": {"token": WalletMockState.random_token()}}


@router.post("/merchant/activate")
async def merchant_activate(request: Request):
    body = await _json_body(request)
    return {
        "result": {
            "contractId": f"LAN{WalletMockState.next_reference_id()[:16]}"
        }
    }


# ===================================================================
# 4.12  Merchant to Merchant
# ===================================================================

@router.post("/merchant/transaction/simulation")
async def merchant_to_merchant_sim(request: Request):
    body = await _json_body(request)
    amount = float(body.get("Amount", 0))
    return {
        "result": [
            {
                "amount": str(amount),
                "beneficiaryFirstName": "Merchant",
                "beneficiaryLastName": "Dest",
                "beneficiaryRIB": None,
                "clientNote": body.get("ClientNote", "M2M"),
                "contractId": None,
                "currency": None,
                "date": None,
                "dateToCompare": "0001-01-01T00:00:00Z",
                "frais": [
                    {"currency": "MAD", "fullName": "", "name": "COM", "referenceId": WalletMockState.next_reference_id(), "value": 3.33},
                    {"currency": "MAD", "fullName": "", "name": "TVA", "referenceId": WalletMockState.next_reference_id(), "value": 0.67},
                ],
                "numTel": None,
                "operation": None,
                "referenceId": WalletMockState.next_reference_id(),
                "sign": None,
                "srcDestNumber": None,
                "status": None,
                "totalAmount": str(amount),
                "totalFrai": "4.00",
                "type": "CC",
                "isCanceled": False,
                "isTierCashIn": False,
                "walletType": "",
            }
        ]
    }


@router.post("/merchant/transaction/otp")
async def merchant_to_merchant_otp(request: Request):
    return {"result": [{"codeOtp": WalletMockState.random_otp()}]}


@router.post("/merchant/transaction/confirmation")
async def merchant_to_merchant_confirm(request: Request):
    return {
        "result": {
            "creditAmounts": None,
            "debitAmounts": None,
            "depot": None,
            "retrait": None,
            "value": f"{WalletMockState.get_balance():.3f}",
        }
    }


# ===================================================================
# 4.13  Dynamic QR code
# ===================================================================

@router.post("/wallet/pro/qrcode/dynamic")
async def qrcode_dynamic(request: Request):
    body = await _json_body(request)
    return {
        "result": {
            "phoneNumber": body.get("phoneNumber", ""),
            "reference": "",
            "token": WalletMockState.random_token(),
            "base64Content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "binaryContent": "00020101021226580014COM.QRCODE MOCK",
        }
    }


# ===================================================================
# 4.14  Merchant to Wallet
# ===================================================================

@router.post("/merchant/merchantToWallet/simulation")
async def merchant_to_wallet_sim(request: Request):
    body = await _json_body(request)
    amount = float(body.get("Amount", 0))
    return {
        "result": {
            "amount": amount,
            "feeAmount": 0.0,
        }
    }


@router.post("/merchant/otp/send")
async def merchant_otp_send(request: Request):
    return {"result": ""}


@router.post("/merchant/merchantToWallet/confirmation")
async def merchant_to_wallet_confirm(request: Request):
    body = await _json_body(request)
    amount = float(body.get("Amount", 0))
    WalletMockState.credit(amount)
    WalletMockState.add_transaction(
        {
            "amount": str(amount),
            "currency": "MAD",
            "date": WalletMockState.now_str(),
            "type": "M2W",
            "srcDestNumber": body.get("BeneficiaryPhoneNumber", ""),
            "referenceId": WalletMockState.next_reference_id(),
            "status": "000",
            "clientNote": "Merchant to Wallet",
        }
    )
    return {
        "result": {
            "contractId": None,
            "reference": WalletMockState.next_reference_id(),
            "transferAmount": 0,
        }
    }


# ===================================================================
# Helper
# ===================================================================

async def _json_body(request: Request) -> dict[str, Any]:
    try:
        return await request.json()
    except Exception:
        return {}