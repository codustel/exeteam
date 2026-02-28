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
  totalLabel: { width: 120, textAlign: 'right', color: '#666' },
  totalValue: { width: 80, textAlign: 'right' },
  totalBold: { fontWeight: 'bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
});

interface QuotePDFProps {
  quote: {
    reference: string;
    quoteDate: string;
    validUntil?: string;
    status: string;
    client: { name: string; addressLine1?: string; city?: string; vatNumber?: string };
    lines: Array<{ designation: string; quantity: number; unitPrice: number; totalHt: number }>;
    totalHt: number;
    vatAmount: number;
    totalTtc: number;
    vatRate: number;
    discount?: number;
    conditions?: string;
    currency?: { symbol: string };
  };
}

const fmt = (n: number, symbol = '€') => `${Number(n).toFixed(2)} ${symbol}`;

export function QuotePDF({ quote }: QuotePDFProps) {
  const sym = quote.currency?.symbol ?? '€';

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
            <Text style={styles.title}>DEVIS</Text>
            <Text style={{ fontWeight: 'bold' }}>N° {quote.reference}</Text>
            <Text style={{ color: '#666' }}>
              Date : {new Date(quote.quoteDate).toLocaleDateString('fr-FR')}
            </Text>
            {quote.validUntil && (
              <Text style={{ color: '#666' }}>
                Valide jusqu'au : {new Date(quote.validUntil).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </View>
        </View>

        {/* Client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CLIENT</Text>
          <Text style={{ fontWeight: 'bold' }}>{quote.client.name}</Text>
          {quote.client.addressLine1 && <Text>{quote.client.addressLine1}</Text>}
          {quote.client.city && <Text>{quote.client.city}</Text>}
          {quote.client.vatNumber && <Text>TVA: {quote.client.vatNumber}</Text>}
        </View>

        {/* Lines table */}
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.colWide}>Désignation</Text>
            <Text style={styles.col}>Qté</Text>
            <Text style={styles.col}>P.U. HT</Text>
            <Text style={styles.col}>Total HT</Text>
          </View>
          {quote.lines.map((line, i) => (
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
            <Text style={styles.totalValue}>{fmt(quote.totalHt, sym)}</Text>
          </View>
          {quote.discount ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remise ({quote.discount}%)</Text>
              <Text style={styles.totalValue}>- {fmt(quote.totalHt * quote.discount / 100, sym)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({quote.vatRate}%)</Text>
            <Text style={styles.totalValue}>{fmt(quote.vatAmount, sym)}</Text>
          </View>
          <View style={[styles.totalRow, { borderTop: '1pt solid #1A1A1A', paddingTop: 4 }]}>
            <Text style={[styles.totalLabel, styles.totalBold]}>Total TTC</Text>
            <Text style={[styles.totalValue, styles.totalBold]}>{fmt(quote.totalTtc, sym)}</Text>
          </View>
        </View>

        {/* Conditions */}
        {quote.conditions && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>CONDITIONS</Text>
            <Text>{quote.conditions}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          ExeTeam SAS — TVA intracommunautaire FR XX XXX XXX XXX — SIRET XXX XXX XXX XXXXX
        </Text>
      </Page>
    </Document>
  );
}
