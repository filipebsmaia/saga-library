export interface ParentSagaContext {
  parentSagaId?: string;
  rootSagaId: string;
  ancestorChain?: string[];
}
