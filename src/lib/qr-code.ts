/**
 * QR code generation utility.
 * Generates data URIs for use in both browser preview and PDF rendering.
 */

import QRCode from 'qrcode'

/**
 * Generate a UPI payment QR code data URI.
 * UPI deep link format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR
 */
export async function generateUpiQrCode(
  upiId: string,
  payeeName: string,
  amount?: number
): Promise<string> {
  const params = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    cu: 'INR',
  })
  if (amount && amount > 0) {
    params.set('am', amount.toFixed(2))
  }
  const upiUrl = `upi://pay?${params.toString()}`
  return QRCode.toDataURL(upiUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
}

/**
 * Generate a generic QR code data URI for any text payload.
 */
export async function generateQrCode(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { width: 120, margin: 1, errorCorrectionLevel: 'M' })
}
