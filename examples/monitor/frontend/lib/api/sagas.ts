import { SagaStateDto, SagaEventDto, SagaMetricsDto, DashboardStatsDto, AttentionResponseDto, SagaPredictionsDto } from '@/lib/types/saga';
import { TopStepDto, TopSagaTypeDto } from '@/lib/types/trends';
import { CursorPaginationResult, ListSagasParams, ListSagaEventsParams } from '@/lib/types/api';
import { apiFetch } from './client';

export function fetchSagas(
  params: ListSagasParams = {},
): Promise<CursorPaginationResult<SagaStateDto>> {
  return apiFetch('/sagas', params as Record<string, string | number | boolean | undefined>);
}

export function fetchSagaDetail(sagaId: string): Promise<SagaStateDto> {
  return apiFetch(`/sagas/${sagaId}`);
}

export function fetchSagaEvents(
  sagaId: string,
  params: ListSagaEventsParams = {},
): Promise<CursorPaginationResult<SagaEventDto>> {
  return apiFetch(`/sagas/${sagaId}/events`, params as Record<string, string | number | boolean | undefined>);
}

export function fetchSagaMetrics(sagaId: string): Promise<SagaMetricsDto> {
  return apiFetch(`/sagas/${sagaId}/metrics`);
}

export function fetchSagaTree(rootId: string): Promise<SagaStateDto[]> {
  return apiFetch(`/sagas/root/${rootId}`);
}

export function fetchDashboardStats(): Promise<DashboardStatsDto> {
  return apiFetch('/sagas/stats');
}

export function fetchAttentionItems(): Promise<AttentionResponseDto> {
  return apiFetch('/sagas/attention');
}

export function fetchTopSteps(): Promise<TopStepDto[]> {
  return apiFetch('/sagas/top-steps');
}

export function fetchTopTypes(): Promise<TopSagaTypeDto[]> {
  return apiFetch('/sagas/top-types');
}

export function fetchSagaPredictions(sagaId: string): Promise<SagaPredictionsDto> {
  return apiFetch(`/sagas/${sagaId}/predictions`);
}
