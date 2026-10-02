import { MetadataRoute } from 'next';
import { motorData } from '@/lib/motor-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://motorhonda-pantura.id';
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, priority: 1.0 },
    { url: `${baseUrl}/simulasi-kredit`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/honda-pekalongan`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/honda-pemalang`, lastModified, priority: 0.8 },
    { url: `${baseUrl}/honda-batang`, lastModified, priority: 0.8 },
  ];

  const motorPages: MetadataRoute.Sitemap = motorData.map((m) => ({
    url: `${baseUrl}/motor/${m.id}`,
    lastModified,
    priority: 0.7,
  }));

  return [...staticPages, ...motorPages];
}
