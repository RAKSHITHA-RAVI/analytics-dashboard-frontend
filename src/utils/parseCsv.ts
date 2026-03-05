import Papa from "papaparse";

export function parseCsv(text: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const data = (results?.data as any[]) || [];
        resolve(data);
      },
      error: (err: any) => reject(err),
    });
  });
}