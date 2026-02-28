import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1A1A1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logo: { fontSize: 20, fontWeight: 'bold', color: '#FF6600' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#1A1A1A' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#666' },
  row: { flexDirection: 'row', borderBottom: '1pt solid #eee', paddingVertical: 4 },
  col: { flex: 1 },
  colWide: { flex: 3 },
  headerRow: { flexDirection: 'row', backgroundColor: '#FF6600', color: 'white', padding: 6, marginBottom: 2 },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', gap: 16, paddingVertical: 2 },
  totalLabel: { width: 140, textAlign: 'right', color: '#666' },
  totalValue: { width: 80, textAlign: 'right' },
  totalBold: { fontWeight: 'bold', fontSize: 12 },
  paidRow: { backgroundColor: '#f0fdf4' },
  dueRow: { backgroundColor: '#fff7ed' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
});

interface InvoicePDFProps {
  invoice: {
    reference: string;
    invoiceDate: string;
    dueDate?: string;
    status: string;
    client: { name: string; addressLine1?: string; city?: string; vatNumber?: string };
    lines: Array<{ designation: string; quantity: number; unitPrice: number; totalHt: number }>;
    totalHt: number;
    vatAmount: number;
    totalTtc: number;
    vatRate: number;
    amountPaid?: number;
    currency?: { symbol: string };
    order?: { reference: string } | null;
    attachment?: { reference: string; period: string } | null;
  };
}

const fmt = (n: number, symbol = '€') => `${Number(n).toFixed(2)} ${symbol}`;

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const sym = invoice.currency?.symbol ?? '€';
  const amountPaid = invoice.amountPaid ?? 0;
  const remaining = Number(invoice.totalTtc) - amountPaid;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>ExeTeam</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>Bureau d'Études</Text>
          </View>
          <View>
            <Text style={styles.title}>FACTURE</Text>
            <Text style={{ fontWeight: 'bold' }}>N° {invoice.reference}</Text>
            <Text style={{ color: '#666' }}>
              Date : {new Date(invoice.invoiceDate).toLocaleDateString('fr-FR')}
            </Text>
            {invoice.dueDate && (
              <Text style={{ color: '#666' }}>
                Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
              </Text>
            )}
            {invoice.order && (
              <Text style={{ color: '#666' }}>Bon de commande : {invoice.order.reference}</Text>
            )}
            {invoice.attachment && (
              <Text style={{ color: '#666' }}>
                Bordereau : {invoice.attachment.reference} ({invoice.attachment.period})
              </Text>
            )}
          </View>
        </View>

        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLIENT</Text>
          <Text style={{ fontWeight: 'bold' }}>{invoice.client.name}</Text>
          {invoice.client.addressLine1 && <Text>{invoice.client.addressLine1}</Text>}
          {invoice.client.city && <Text>{invoice.client.city}</Text>}
          {invoice.client.vatNumber && <Text>TVA: {invoice.client.vatNumber}</Text>}
        </View>

        {/* Lines table */}
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.colWide}>Désignation</Text>
            <Text style={styles.col}>Qté</Text>
            <Text style={styles.col}>P.U. HT</Text>
            <Text style={styles.col}>Total HT</Text>
          </View>
          {invoice.lines.map((line, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colWide}>{line.designation}</Text>
              <Text style={styles.col}>{line.quantity}</Text>
              <Text style={styles.col}>{fmt(line.unitPrice, sym)}</Text>
              <Text style={styles.col}>{fmt(line.totalHt, sym)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValue}>{fmt(invoice.totalHt, sym)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({invoice.vatRate}%)</Text>
            <Text style={styles.totalValue}>{fmt(invoice.vatAmount, sym)}</Text>
          </View>
          <View style={[styles.totalRow, { borderTop: '1pt solid #1A1A1A', paddingTop: 4 }]}>
            <Text style={[styles.totalLabel, styles.totalBold]}>Total TTC</Text>
            <Text style={[styles.totalValue, styles.totalBold]}>{fmt(invoice.totalTtc, sym)}</Text>
          </View>
          {amountPaid > 0 && (
            <>
              <View style={[styles.totalRow, styles.paidRow]}>
                <Text style={styles.totalLabel}>Montant payé</Text>
                <Text style={styles.totalValue}>{fmt(amountPaid, sym)}</Text>
              </View>
              <View style={[styles.totalRow, styles.dueRow]}>
                <Text style={[styles.totalLabel, styles.totalBold]}>Reste dû</Text>
                <Text style={[styles.totalValue, styles.totalBold]}>{fmt(remaining, sym)}</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footer}>
          ExeTeam SAS — TVA intracommunautaire FR XX XXX XXX XXX — SIRET XXX XXX XXX XXXXX
        </Text>
      </Page>
    </Document>
  );
}
