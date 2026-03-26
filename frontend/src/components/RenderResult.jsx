// src/components/RenderResult.jsx
import { Card } from '@/components/ui/card';
import { TopProductsCard, BrokenFlowsCard, JournalEntriesCard, FormattedOutput } from './ResultCards';
import {
  FIND_TOP_PRODUCTS,
  FIND_BROKEN_FLOWS,
  FIND_JOURNAL,
  TRACE_FULL_FLOW,
  FIND_REVERSALS,
} from '../constants/actionTypes';

export const RenderResult = ({ action, result }) => {
  if (!action || !result) return null;

  switch (action) {
    case FIND_TOP_PRODUCTS:
      return <TopProductsCard data={result} />;
    case FIND_BROKEN_FLOWS:
      return <BrokenFlowsCard data={result} />;
    case FIND_JOURNAL:
      return <JournalEntriesCard data={result} />;
    case TRACE_FULL_FLOW:
    case FIND_REVERSALS:
      return <FormattedOutput data={result} />;
    default:
      return (
        <Card className="p-4 rounded-xl shadow-md">
          <p className="text-sm text-muted-foreground">Unsupported query type.</p>
        </Card>
      );
  }
};
