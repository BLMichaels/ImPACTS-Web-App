-- Program-specific checklists for PECCs. Each program can have one or more checklists
-- that appear on the PECC Checklist tab (before or after the default checklist).
-- Progress is stored in site_checklist_progress with task_id = 'program:<checklist_id>:<step_id>'.

-- program_checklists: one per program (or multiple per program)
CREATE TABLE IF NOT EXISTS public.program_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  show_before_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.program_checklists IS 'Program-specific checklists for PECCs. show_before_default: true = show this checklist before the default; false = after.';
CREATE INDEX IF NOT EXISTS idx_program_checklists_program_id ON public.program_checklists(program_id);

-- program_checklist_stages: stages within a checklist (name, color, etc.)
CREATE TABLE IF NOT EXISTS public.program_checklist_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.program_checklists(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  subtitle TEXT,
  color_hex TEXT,
  objectives JSONB DEFAULT '[]'::jsonb,
  goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.program_checklist_stages.color_hex IS 'Stage header color e.g. #2196F3';
CREATE INDEX IF NOT EXISTS idx_program_checklist_stages_checklist_id ON public.program_checklist_stages(checklist_id);

-- program_checklist_tasks: steps within a stage (text with optional links/formatting)
CREATE TABLE IF NOT EXISTS public.program_checklist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.program_checklist_stages(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  task_id_suffix TEXT NOT NULL,
  text_content TEXT NOT NULL,
  links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.program_checklist_tasks.task_id_suffix IS 'Step id within stage e.g. 1, 2; full task_id in progress = program:<checklist_id>:<stage_idx>.<suffix>';
COMMENT ON COLUMN public.program_checklist_tasks.links IS 'Array of { text, url } for hyperlinks in content';
CREATE INDEX IF NOT EXISTS idx_program_checklist_tasks_stage_id ON public.program_checklist_tasks(stage_id);

ALTER TABLE public.program_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_checklist_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_checklist_tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (for PECC/Mentor/Manager to display)
CREATE POLICY "Authenticated read program_checklists" ON public.program_checklists FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read program_checklist_stages" ON public.program_checklist_stages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read program_checklist_tasks" ON public.program_checklist_tasks FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify
CREATE POLICY "Admins manage program_checklists" ON public.program_checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "Admins manage program_checklist_stages" ON public.program_checklist_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);
CREATE POLICY "Admins manage program_checklist_tasks" ON public.program_checklist_tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

CREATE TRIGGER update_program_checklists_updated_at BEFORE UPDATE ON public.program_checklists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_program_checklist_stages_updated_at BEFORE UPDATE ON public.program_checklist_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_program_checklist_tasks_updated_at BEFORE UPDATE ON public.program_checklist_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
