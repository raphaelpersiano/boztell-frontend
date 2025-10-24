'use client';

import React from 'react';
import { Layout } from '@/components/Layout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function LeadsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
      <Layout>
        <LeadsTable />
      </Layout>
    </ProtectedRoute>
  );
}