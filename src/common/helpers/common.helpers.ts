export function formatTime(time: string | undefined): string {
  const today = new Date().toISOString().split('T')[0]; // Ambil tanggal hari ini
  return new Date(`${today}T${time}Z`).toISOString();
}
