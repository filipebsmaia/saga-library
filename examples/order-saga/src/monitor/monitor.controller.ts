import { Controller, Get, Param, Res, Sse, MessageEvent } from "@nestjs/common";
import type { Response } from "express";
import { Observable, fromEvent, map } from "rxjs";
import { MonitorService, SagaTraceEvent } from "./monitor.service";
import { MONITOR_HTML } from "./monitor.html";
import { DASHBOARD_HTML } from "./dashboard.html";
import { SAGA_DETAIL_HTML } from "./saga-detail.html";

@Controller("monitor")
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get()
  servePage(@Res() res: Response): void {
    res.type("text/html").send(MONITOR_HTML);
  }

  @Get("dashboard")
  serveDashboard(@Res() res: Response): void {
    res.type("text/html").send(DASHBOARD_HTML);
  }

  @Get("saga/:id")
  serveSagaDetail(@Res() res: Response): void {
    res.type("text/html").send(SAGA_DETAIL_HTML);
  }

  @Get("api/sagas")
  listSagas() {
    return this.monitorService.getAllSagas();
  }

  @Get("api/events")
  listEvents() {
    const result: Record<string, SagaTraceEvent[]> = {};
    for (const [sagaId, events] of this.monitorService.getEventsBySaga()) {
      result[sagaId] = events;
    }
    return result;
  }

  @Get("api/events/:sagaId")
  listEventsForSaga(@Param("sagaId") sagaId: string) {
    return this.monitorService.getEventsForSagaGroup(sagaId);
  }

  @Get("api/stats")
  getStats() {
    return this.monitorService.getAggregatedStats();
  }

  @Get("api/durations-by-type")
  getDurationsByType() {
    return this.monitorService.getDurationsByType();
  }

  @Sse("stream")
  stream(): Observable<MessageEvent> {
    return fromEvent<SagaTraceEvent>(this.monitorService, "saga-event").pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}
