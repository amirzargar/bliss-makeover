import { useRef } from 'react'

export default function Invoice({ transaction, appointment, onClose }) {
    const invoiceRef = useRef()

    const salonInfo = {
        name: 'Bliss Makeover',
        tagline: 'Hair | Makeup | Skin',
        address: 'Jammu, Jammu and Kashmir',
        phone: '+91 9419XXXXXX',
        email: 'blissmakeover@gmail.com',
        gstin: null,
    }

    const invoiceNumber = 'BM-' +
        new Date(transaction.created_at).toISOString().slice(0, 10).replace(/-/g, '') +
        '-' + transaction.id.slice(0, 4).toUpperCase()

    const date = new Date(transaction.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
    })

    const time = new Date(transaction.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit'
    })

    const subtotal = Number(transaction.subtotal || 0)
    const discountAmount = Number(transaction.discount_amount || 0)
    const loyaltyRedeemed = Number(transaction.loyalty_redeemed || 0)
    const total = Number(transaction.total || 0)
    const pointsEarned = Math.floor(total / 10)

    const customerName = transaction.customers?.name || appointment?.customers?.name || 'Customer'
    const customerPhone = transaction.customers?.phone || appointment?.customers?.phone || ''
    const serviceName = appointment?.services?.name || 'Service'
    const serviceCategory = appointment?.services?.category || ''
    const staffName = appointment?.users?.name || '-'

    async function downloadPDF() {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF('p', 'mm', 'a4')
        const pink = [219, 39, 119]
        const dark = [30, 30, 30]
        const gray = [100, 100, 100]
        const ltgray = [200, 200, 200]
        const ltpink = [253, 242, 248]
        const green = [5, 150, 105]
        const pageW = doc.internal.pageSize.getWidth()
        let y = 20

        // Header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(20)
        doc.setTextColor(...pink)
        doc.text(salonInfo.name, 20, y)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        doc.text(salonInfo.tagline, 20, y + 6)
        doc.text(salonInfo.address, 20, y + 12)
        doc.text('Phone: ' + salonInfo.phone, 20, y + 17)
        doc.text('Email: ' + salonInfo.email, 20, y + 22)
        if (salonInfo.gstin) doc.text('GSTIN: ' + salonInfo.gstin, 20, y + 27)

        // Receipt label top right
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(...dark)
        doc.text('RECEIPT', pageW - 20, y, { align: 'right' })

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...gray)
        doc.text('#' + invoiceNumber, pageW - 20, y + 7, { align: 'right' })
        doc.text(date, pageW - 20, y + 12, { align: 'right' })
        doc.text(time, pageW - 20, y + 17, { align: 'right' })

        y += 35

        // Pink divider line
        doc.setDrawColor(...pink)
        doc.setLineWidth(0.8)
        doc.line(20, y, pageW - 20, y)
        y += 10

        // Bill To
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...gray)
        doc.text('BILL TO', 20, y)
        y += 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...dark)
        doc.text(customerName, 20, y)
        y += 5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        if (customerPhone) { doc.text(customerPhone, 20, y); y += 5 }
        y += 5

        // Service table header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...gray)
        doc.text('SERVICE DETAILS', 20, y)
        y += 4

        doc.setFillColor(...ltpink)
        doc.rect(20, y, pageW - 40, 8, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(...pink)
        doc.text('Service', 22, y + 5.5)
        doc.text('Staff', 110, y + 5.5)
        doc.text('Amount', pageW - 22, y + 5.5, { align: 'right' })
        y += 10

        // Service row
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(...dark)
        doc.text(serviceName, 22, y)
        doc.setFontSize(9)
        doc.setTextColor(...gray)
        if (serviceCategory) doc.text(serviceCategory, 22, y + 4)
        doc.setFontSize(11)
        doc.setTextColor(...dark)
        doc.text(staffName, 110, y)
        doc.text('Rs.' + subtotal.toLocaleString('en-IN'), pageW - 22, y, { align: 'right' })

        y += 14

        // Light gray divider
        doc.setDrawColor(...ltgray)
        doc.setLineWidth(0.3)
        doc.line(20, y, pageW - 20, y)
        y += 8

        // Bill summary box
        doc.setFillColor(249, 250, 251)
        doc.rect(20, y, pageW - 40, discountAmount > 0 || loyaltyRedeemed > 0 ? 44 : 30, 'F')
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...gray)
        doc.text('Subtotal', 25, y)
        doc.setTextColor(...dark)
        doc.text('Rs.' + subtotal.toLocaleString('en-IN'), pageW - 25, y, { align: 'right' })
        y += 7

        if (discountAmount > 0) {
            doc.setTextColor(...green)
            doc.text('Discount', 25, y)
            doc.text('- Rs.' + discountAmount.toLocaleString('en-IN'), pageW - 25, y, { align: 'right' })
            y += 7
        }

        if (loyaltyRedeemed > 0) {
            doc.setTextColor(...green)
            doc.text('Loyalty Points Redeemed', 25, y)
            doc.text('- Rs.' + loyaltyRedeemed.toLocaleString('en-IN'), pageW - 25, y, { align: 'right' })
            y += 7
        }

        // Total
        doc.setDrawColor(...ltgray)
        doc.line(25, y, pageW - 25, y)
        y += 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...dark)
        doc.text('Total Paid', 25, y)
        doc.setTextColor(...pink)
        doc.text('Rs.' + total.toLocaleString('en-IN'), pageW - 25, y, { align: 'right' })
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...gray)
        const modeDisplay = transaction.payment_mode.charAt(0).toUpperCase() + transaction.payment_mode.slice(1)
        doc.text('Payment Mode: ' + modeDisplay, 25, y)
        y += 12

        // Loyalty points box
        doc.setFillColor(...ltpink)
        doc.rect(20, y, pageW - 40, loyaltyRedeemed > 0 ? 22 : 16, 'F')
        doc.setDrawColor(...pink)
        doc.setLineWidth(0.3)
        doc.rect(20, y, pageW - 40, loyaltyRedeemed > 0 ? 22 : 16)
        y += 5

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(157, 23, 77)
        doc.text('Loyalty Points Summary', 25, y)
        y += 5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...gray)
        doc.text('Points earned this visit', 25, y)
        doc.setTextColor(...pink)
        doc.setFont('helvetica', 'bold')
        doc.text('+ ' + pointsEarned + ' pts', pageW - 25, y, { align: 'right' })

        if (loyaltyRedeemed > 0) {
            y += 5
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(...gray)
            doc.text('Points redeemed (savings)', 25, y)
            doc.setTextColor(...green)
            doc.setFont('helvetica', 'bold')
            doc.text('Rs.' + loyaltyRedeemed.toLocaleString('en-IN') + ' saved', pageW - 25, y, { align: 'right' })
        }

        y += 8
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...ltgray)
        doc.text('100 points = Rs.10 discount on your next visit', 25, y)
        y += 12

        if (!salonInfo.gstin) {
            doc.setFontSize(8)
            doc.setTextColor(...ltgray)
            doc.text('* GST not applicable - Unregistered business', 20, y)
            y += 10
        }

        // Footer
        doc.setDrawColor(...ltgray)
        doc.setLineWidth(0.3)
        doc.line(20, y, pageW - 20, y)
        y += 8

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...pink)
        doc.text('Thank you for visiting Bliss Makeover!', pageW / 2, y, { align: 'center' })
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...gray)
        doc.text('We look forward to seeing you again soon.', pageW / 2, y, { align: 'center' })
        y += 5

        doc.setFontSize(8)
        doc.setTextColor(...ltgray)
        doc.text(salonInfo.phone + ' | ' + salonInfo.email, pageW / 2, y, { align: 'center' })

        doc.save('Bliss-Receipt-' + invoiceNumber + '.pdf')
    }

    function printInvoice() {
        const content = invoiceRef.current.innerHTML
        const printWin = window.open('', '_blank', 'width=800,height=900')
        printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${invoiceNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 13px; color: #222; }
            .wrap { max-width: 680px; margin: 0 auto; padding: 32px; }
          </style>
        </head>
        <body>
          <div class="wrap">${content}</div>
          <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `)
        printWin.document.close()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl">

                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-sm font-semibold text-gray-800">Receipt Preview</h2>
                    <div className="flex gap-2">
                        <button onClick={printInvoice}
                            className="border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50">
                            Print
                        </button>
                        <button onClick={downloadPDF}
                            className="bg-pink-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-pink-700">
                            Download PDF
                        </button>
                        <button onClick={onClose}
                            className="border border-gray-200 text-gray-400 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                            Close
                        </button>
                    </div>
                </div>

                {/* On-screen preview */}
                <div className="overflow-y-auto flex-1 p-4">
                    <div ref={invoiceRef} style={{ fontFamily: 'Arial, sans-serif', color: '#222', backgroundColor: '#fff', padding: '24px' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#db2777' }}>{salonInfo.name}</div>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{salonInfo.tagline}</div>
                                <div style={{ fontSize: '11px', color: '#666', marginTop: '6px', lineHeight: '1.7' }}>
                                    {salonInfo.address}<br />
                                    Phone: {salonInfo.phone}<br />
                                    Email: {salonInfo.email}
                                    {salonInfo.gstin && <><br />GSTIN: {salonInfo.gstin}</>}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>RECEIPT</div>
                                <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>#{invoiceNumber}</div>
                                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{date}</div>
                                <div style={{ fontSize: '10px', color: '#666' }}>{time}</div>
                            </div>
                        </div>

                        {/* Pink line */}
                        <div style={{ borderTop: '2px solid #db2777', marginBottom: '14px' }} />

                        {/* Bill To */}
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Bill To</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{customerName}</div>
                            {customerPhone && <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{customerPhone}</div>}
                        </div>

                        {/* Service table */}
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Service Details</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fdf2f8', borderBottom: '1px solid #f9a8d4' }}>
                                        <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 'bold', color: '#9d174d' }}>Service</th>
                                        <th style={{ textAlign: 'left', padding: '7px 8px', fontSize: '10px', fontWeight: 'bold', color: '#9d174d' }}>Staff</th>
                                        <th style={{ textAlign: 'right', padding: '7px 8px', fontSize: '10px', fontWeight: 'bold', color: '#9d174d' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '9px 8px', fontSize: '12px', color: '#333' }}>
                                            {serviceName}
                                            {serviceCategory && <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{serviceCategory}</div>}
                                        </td>
                                        <td style={{ padding: '9px 8px', fontSize: '11px', color: '#666' }}>{staffName}</td>
                                        <td style={{ padding: '9px 8px', fontSize: '12px', color: '#333', textAlign: 'right', fontWeight: '500' }}>
                                            Rs.{subtotal.toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Summary box */}
                        <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#666' }}>Subtotal</span>
                                <span style={{ fontSize: '11px', color: '#333' }}>Rs.{subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: '#059669' }}>Discount</span>
                                    <span style={{ fontSize: '11px', color: '#059669' }}>- Rs.{discountAmount.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            {loyaltyRedeemed > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '11px', color: '#059669' }}>Loyalty Points Redeemed</span>
                                    <span style={{ fontSize: '11px', color: '#059669' }}>- Rs.{loyaltyRedeemed.toLocaleString('en-IN')}</span>
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Total Paid</span>
                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#db2777' }}>Rs.{total.toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '10px', color: '#888' }}>Payment Mode</span>
                                <span style={{ fontSize: '10px', color: '#333', fontWeight: '500', textTransform: 'capitalize' }}>
                                    {transaction.payment_mode}
                                </span>
                            </div>
                        </div>

                        {/* Loyalty box */}
                        <div style={{ backgroundColor: '#fdf2f8', border: '1px solid #f9a8d4', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#9d174d', marginBottom: '6px' }}>Loyalty Points Summary</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', color: '#666' }}>Points earned this visit</span>
                                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#db2777' }}>+ {pointsEarned} pts</span>
                            </div>
                            {loyaltyRedeemed > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', color: '#666' }}>Points redeemed</span>
                                    <span style={{ fontSize: '10px', color: '#059669' }}>Rs.{loyaltyRedeemed.toLocaleString('en-IN')} saved</span>
                                </div>
                            )}
                            <div style={{ fontSize: '9px', color: '#aaa', marginTop: '6px' }}>
                                100 points = Rs.10 discount on your next visit
                            </div>
                        </div>

                        {!salonInfo.gstin && (
                            <div style={{ fontSize: '9px', color: '#bbb', marginBottom: '12px' }}>
                                * GST not applicable - Unregistered business
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#db2777', marginBottom: '4px' }}>
                                Thank you for visiting Bliss Makeover!
                            </div>
                            <div style={{ fontSize: '10px', color: '#888' }}>We look forward to seeing you again soon.</div>
                            <div style={{ fontSize: '9px', color: '#bbb', marginTop: '6px' }}>
                                {salonInfo.phone} | {salonInfo.email}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}