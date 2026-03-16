import { SagaStateRepository } from '../../domain/repositories/saga-state.repository';
import { SagaEventLogRepository, TransitionRecord } from '../../domain/repositories/saga-event-log.repository';
import { SagaPredictionsDto, PredictedEventDto } from '../dtos/saga-predictions.dto';
import { SagaStatus } from '../../domain/types/saga-status.enum';

const MAX_CHAIN_LENGTH = 10;

export class GetSagaPredictionsQuery {
  constructor(
    private readonly sagaStateRepo: SagaStateRepository,
    private readonly sagaEventLogRepo: SagaEventLogRepository,
  ) {}

  async execute(sagaId: string): Promise<SagaPredictionsDto | null> {
    const state = await this.sagaStateRepo.findById(sagaId);
    if (!state) return null;
    if (state.status === SagaStatus.COMPLETED) return null;
    if (!state.sagaName) {
      return this.emptyResult(sagaId, state.sagaName ?? '', state.currentStepName, state.lastEventHint);
    }

    const transitions = await this.sagaEventLogRepo.findTransitionMap(state.sagaName);
    if (transitions.length === 0) {
      return this.emptyResult(sagaId, state.sagaName, state.currentStepName, state.lastEventHint);
    }

    const transitionMap = this.buildTransitionMap(transitions);
    const currentKey = this.key(state.currentStepName, state.lastEventHint);

    // Compute sample size: sum of all frequencies from first step transitions / approximate
    const sampleSize = this.estimateSampleSize(transitions);

    // Next possible (immediate)
    const nextPossible = this.getNextPossible(transitionMap, currentKey);

    // Expected chain (follow most probable path)
    const expectedChain = this.buildExpectedChain(transitionMap, currentKey);

    return {
      sagaId,
      sagaName: state.sagaName,
      currentStep: state.currentStepName,
      currentHint: state.lastEventHint,
      nextPossible,
      expectedChain,
      sampleSize,
    };
  }

  private buildTransitionMap(transitions: TransitionRecord[]): Map<string, TransitionRecord[]> {
    const map = new Map<string, TransitionRecord[]>();
    for (const t of transitions) {
      const k = this.key(t.fromStep, t.fromHint);
      const list = map.get(k) ?? [];
      list.push(t);
      map.set(k, list);
    }
    return map;
  }

  private getNextPossible(map: Map<string, TransitionRecord[]>, currentKey: string): PredictedEventDto[] {
    const candidates = map.get(currentKey);
    if (!candidates || candidates.length === 0) return [];

    const totalFreq = candidates.reduce((sum, t) => sum + t.frequency, 0);
    return candidates.map((t) => ({
      stepName: t.toStep,
      eventHint: t.toHint,
      topic: t.toTopic,
      probability: Math.round((t.frequency / totalFreq) * 100) / 100,
    }));
  }

  private buildExpectedChain(map: Map<string, TransitionRecord[]>, startKey: string): PredictedEventDto[] {
    const chain: PredictedEventDto[] = [];
    const visited = new Set<string>();
    let currentKey = startKey;

    for (let i = 0; i < MAX_CHAIN_LENGTH; i++) {
      const candidates = map.get(currentKey);
      if (!candidates || candidates.length === 0) break;

      const totalFreq = candidates.reduce((sum, t) => sum + t.frequency, 0);
      // Pick the most probable transition
      const best = candidates[0]; // Already sorted by frequency DESC from the SQL query
      const probability = Math.round((best.frequency / totalFreq) * 100) / 100;

      chain.push({
        stepName: best.toStep,
        eventHint: best.toHint,
        topic: best.toTopic,
        probability,
      });

      const nextKey = this.key(best.toStep, best.toHint);
      if (visited.has(nextKey)) break; // Avoid infinite loops
      visited.add(nextKey);
      currentKey = nextKey;

      if (best.toHint === 'final') break;
    }

    return chain;
  }

  private estimateSampleSize(transitions: TransitionRecord[]): number {
    // Approximate: max frequency of any single transition is a good lower bound
    return transitions.reduce((max, t) => Math.max(max, t.frequency), 0);
  }

  private key(step: string, hint: string | null): string {
    return `${step}:${hint ?? ''}`;
  }

  private emptyResult(
    sagaId: string,
    sagaName: string,
    currentStep: string,
    currentHint: string | null,
  ): SagaPredictionsDto {
    return {
      sagaId,
      sagaName,
      currentStep,
      currentHint,
      nextPossible: [],
      expectedChain: [],
      sampleSize: 0,
    };
  }
}
