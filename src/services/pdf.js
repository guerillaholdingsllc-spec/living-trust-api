import PDFDocument from "pdfkit";

export async function buildPdfPackage(packageJson) {
  return Promise.all([
    makePdf("Living Trust", packageJson.trustDocument),
    makePdf("Pour-Over Will", packageJson.pourOverWill),
    makePdf("Certificate of Trust", packageJson.certificateOfTrust),
    makePdf("Funding Instructions", packageJson.fundingInstructions)
  ]);
}

function makePdf(filename, body) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 54 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve({
      filename: `${filename.replaceAll(" ", "-").toLowerCase()}.pdf`,
      content: Buffer.concat(chunks).toString("base64"),
      type: "application/pdf",
      disposition: "attachment"
    }));
    doc.font("Times-Bold").fontSize(16).text(filename, { align: "center" });
    doc.moveDown();
    doc.font("Times-Roman").fontSize(11).text(body, { align: "left", lineGap: 4 });
    doc.end();
  });
}
