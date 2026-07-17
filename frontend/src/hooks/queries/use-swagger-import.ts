import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import type { ID } from '@/types/api';
import type {
  SwaggerImportCommitResponse,
  SwaggerImportDecision,
  SwaggerImportItem,
  SwaggerImportParseResponse,
} from '@/types/api';

export function useParseSwagger() {
  return useMutation({
    mutationFn: async (vars: { featureGroupId: ID; fileName: string; content: string }) =>
      unwrap(
        await api.post<SwaggerImportParseResponse>(
          `/feature-groups/${vars.featureGroupId}/swagger/parse`,
          { fileName: vars.fileName, content: vars.content },
        ),
      ),
  });
}

export type CommitSwaggerVars = {
  featureGroupId: ID;
  decisions: SwaggerImportDecision[];
  items: SwaggerImportItem[];
};

export function useCommitSwagger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CommitSwaggerVars) => {
      // 将 items 数组转为 index → item 的 record，方便后端按 index 取
      const itemsRecord: Record<string, SwaggerImportItem> = {};
      for (const it of vars.items) {
        itemsRecord[String(it.index)] = it;
      }
      return unwrap(
        await api.post<SwaggerImportCommitResponse>(
          `/feature-groups/${vars.featureGroupId}/swagger/commit`,
          {
            decisions: vars.decisions,
            items: itemsRecord,
          },
        ),
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['mock-apis', 'group', vars.featureGroupId] });
      qc.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}
