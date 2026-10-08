import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "Cargar reportes" y "Gestor de reportes" se unieron en /reportes
  async redirects() {
    return [
      { source: "/cargar-reportes", destination: "/reportes", permanent: true },
      { source: "/gestor-reportes", destination: "/reportes", permanent: true },
    ];
  },
};

export default nextConfig;
