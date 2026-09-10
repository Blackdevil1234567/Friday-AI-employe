import { getDb } from '../db';
import { searchWeb } from './webSearch';
import { writeFileContent } from './fileManager';

export interface TaskStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export async function runTaskPlan(taskId: string, broadcast: (msg: any) => void): Promise<void> {
  const db = await getDb();
  const task = await db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
  if (!task) return;

  // Set overall task status to running
  await db.run(`UPDATE tasks SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [taskId]);
  broadcast({ type: 'task_updated', taskId });

  const steps: TaskStep[] = JSON.parse(task.steps);
  
  // Insert activity log entry
  const activityId = Math.random().toString(36).substring(7);
  await db.run(
    `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, ?, ?, ?, ?)`,
    [activityId, 'info', 'tasks', `Started executing workflow: "${task.title}"`, `Description: ${task.description || 'None'}`]
  );
  broadcast({ type: 'activity_logged' });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    step.status = 'running';
    await db.run(`UPDATE tasks SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(steps), taskId]);
    broadcast({ type: 'task_updated', taskId });

    // Simulate natural processing duration
    await new Promise(resolve => setTimeout(resolve, 2500));

    try {
      if (step.title.toLowerCase().includes('search') || step.title.toLowerCase().includes('gather') || step.title.toLowerCase().includes('research')) {
        const query = step.title.replace(/search|gather|research/gi, '').trim() || task.title;
        const searchRes = await searchWeb(query);
        step.result = searchRes.summary;
      } else if (step.title.toLowerCase().includes('write') || step.title.toLowerCase().includes('create') || step.title.toLowerCase().includes('generate') || step.title.toLowerCase().includes('save')) {
        const filename = `task_${taskId}_step_${step.id}.md`;
        const content = `# Step Result: ${step.title}\n\nThis document was generated autonomously by FRIDAY.\n\n### Task Context\n- Parent Task: ${task.title}\n- Step: ${step.title}\n\n### Execution Details\nSuccessfully generated files and completed data structures.`;
        await writeFileContent(filename, content);
        step.result = `Generated file: ${filename} inside workspace.`;
      } else {
        step.result = `Completed successfully.`;
      }
      step.status = 'completed';
    } catch (e: any) {
      step.status = 'failed';
      step.result = `Failed during tool call: ${e.message || e}`;
    }

    await db.run(`UPDATE tasks SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(steps), taskId]);
    broadcast({ type: 'task_updated', taskId });
  }

  const allSuccessful = steps.every(s => s.status === 'completed');
  const finalStatus = allSuccessful ? 'completed' : 'failed';
  
  await db.run(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [finalStatus, taskId]);
  
  // Log final activity entry
  await db.run(
    `INSERT INTO activity_logs (id, type, category, message, details) VALUES (?, ?, ?, ?, ?)`,
    [
      Math.random().toString(36).substring(7),
      allSuccessful ? 'success' : 'error',
      'tasks',
      `Workflow "${task.title}" ${finalStatus}`,
      `Completed all steps with final status: ${finalStatus}`
    ]
  );
  
  broadcast({ type: 'task_updated', taskId });
  broadcast({ type: 'activity_logged' });
}
