'use client';
import '../lexis-report-complete-theme.css';
import '../lexis-report-visual-system.css';
import '../lexis-report-print.css';
import OfficeConsole from '../../components/office-console';
import ReportPage from '../report/page';
export default function Page(){
 return process.env.NEXT_PUBLIC_LEXIS_SHARED_DB==='1'
  ?<ReportPage/>
  :<OfficeConsole area="reports"/>;
}
