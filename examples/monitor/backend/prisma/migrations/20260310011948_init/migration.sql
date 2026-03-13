-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('RUNNING', 'COMPENSATING', 'COMPLETED');

-- CreateTable
CREATE TABLE "saga_state" (
    "saga_id" TEXT NOT NULL,
    "saga_root_id" TEXT NOT NULL,
    "saga_parent_id" TEXT,
    "saga_name" TEXT,
    "saga_description" TEXT,
    "status" "SagaStatus" NOT NULL DEFAULT 'RUNNING',
    "current_step_name" TEXT NOT NULL,
    "current_step_description" TEXT,
    "last_event_id" TEXT NOT NULL,
    "last_event_hint" TEXT,
    "last_causation_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "event_count" INTEGER NOT NULL DEFAULT 1,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "last_topic" TEXT,
    "last_partition" INTEGER,
    "last_offset" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,

    CONSTRAINT "saga_state_pkey" PRIMARY KEY ("saga_id")
);

-- CreateTable
CREATE TABLE "saga_event_log" (
    "saga_event_id" TEXT NOT NULL,
    "saga_id" TEXT NOT NULL,
    "saga_root_id" TEXT NOT NULL,
    "saga_parent_id" TEXT,
    "saga_causation_id" TEXT NOT NULL,
    "saga_name" TEXT,
    "saga_description" TEXT,
    "saga_step_name" TEXT NOT NULL,
    "saga_step_description" TEXT,
    "saga_event_hint" TEXT,
    "saga_published_at" TIMESTAMP(3) NOT NULL,
    "saga_schema_version" INTEGER NOT NULL DEFAULT 1,
    "topic" TEXT NOT NULL,
    "partition" INTEGER,
    "offset_" TEXT,
    "status_before" "SagaStatus",
    "status_after" "SagaStatus" NOT NULL,
    "headers_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saga_event_log_pkey" PRIMARY KEY ("saga_event_id")
);

-- CreateIndex
CREATE INDEX "idx_saga_state_status_updated" ON "saga_state"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_saga_state_root_updated" ON "saga_state"("saga_root_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_saga_state_parent_updated" ON "saga_state"("saga_parent_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_saga_state_name_updated" ON "saga_state"("saga_name", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_saga_state_updated" ON "saga_state"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_saga_state_ended_at" ON "saga_state"("ended_at");

-- CreateIndex
CREATE INDEX "idx_saga_state_started_ended" ON "saga_state"("started_at", "ended_at");

-- CreateIndex
CREATE INDEX "idx_saga_state_name_created" ON "saga_state"("saga_name", "created_at");

-- CreateIndex
CREATE INDEX "idx_event_log_saga_published" ON "saga_event_log"("saga_id", "saga_published_at" ASC);

-- CreateIndex
CREATE INDEX "idx_event_log_root_published" ON "saga_event_log"("saga_root_id", "saga_published_at" ASC);

-- CreateIndex
CREATE INDEX "idx_event_log_causation" ON "saga_event_log"("saga_causation_id");

-- CreateIndex
CREATE INDEX "idx_event_log_hint_published" ON "saga_event_log"("saga_event_hint", "saga_published_at" DESC);

-- CreateIndex
CREATE INDEX "idx_event_log_topic_partition_offset" ON "saga_event_log"("topic", "partition", "offset_");

-- CreateIndex
CREATE INDEX "idx_event_log_published" ON "saga_event_log"("saga_published_at" DESC);

-- CreateIndex
CREATE INDEX idx_saga_state_active ON saga_state (started_at) WHERE ended_at IS NULL;

CREATE INDEX idx_saga_state_created_name ON saga_state (created_at, saga_name) WHERE saga_name IS NOT NULL;

-- AddForeignKey
ALTER TABLE "saga_event_log" ADD CONSTRAINT "saga_event_log_saga_id_fkey" FOREIGN KEY ("saga_id") REFERENCES "saga_state"("saga_id") ON DELETE RESTRICT ON UPDATE CASCADE;


