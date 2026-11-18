import importlib.util, pathlib, unittest
p=pathlib.Path(__file__).parents[2]/'scripts/ci/deploy_frontend.py'
spec=importlib.util.spec_from_file_location('deploy',p); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SHA='a'*40
class DeployTests(unittest.TestCase):
 def run_deploy(self,jobs=None,commit=SHA,head=SHA,start_error=False,status='SUCCEED',live=SHA):
  calls=[]
  def aws(op,**kw):
   calls.append(op)
   if op=='get-branch':return {'enableAutoBuild':False}
   if op=='list-jobs':return jobs or []
   if op=='start-job':
    if start_error:raise RuntimeError('uncertain')
    return {'jobId':'42','commitId':commit,'status':'PENDING'}
   return {'jobId':'42','commitId':commit,'status':status}
  result=lambda:m.deploy(SHA,aws,lambda:head,lambda:live,lambda _:None,lambda:0)
  return result,calls
 def test_starts_once_verifies_commit_and_live(self):
  run,calls=self.run_deploy();self.assertEqual(run(),'42');self.assertEqual(calls.count('start-job'),1)
 def test_old_head_stops_before_start(self):
  run,calls=self.run_deploy(head='b'*40)
  with self.assertRaisesRegex(RuntimeError,'main moved'):run()
  self.assertNotIn('start-job',calls)
 def test_busy_other_commit_stops(self):
  run,calls=self.run_deploy(jobs=[{'jobId':'9','commitId':'b'*40,'status':'RUNNING'}])
  with self.assertRaisesRegex(RuntimeError,'another'):run()
  self.assertNotIn('start-job',calls)
 def test_resumes_same_commit_without_duplicate(self):
  run,calls=self.run_deploy(jobs=[{'jobId':'42','commitId':SHA,'status':'RUNNING'}]);self.assertEqual(run(),'42');self.assertNotIn('start-job',calls)
 def test_uncertain_start_never_retries(self):
  run,calls=self.run_deploy(start_error=True)
  with self.assertRaisesRegex(RuntimeError,'uncertain'):run()
  self.assertEqual(calls.count('start-job'),1)
 def test_commit_drift_fails(self):
  run,_=self.run_deploy(commit='b'*40)
  with self.assertRaisesRegex(RuntimeError,'commit mismatch'):run()
 def test_failed_job_fails(self):
  run,_=self.run_deploy(status='FAILED')
  with self.assertRaisesRegex(RuntimeError,'FAILED'):run()
 def test_live_mismatch_not_success(self):
  run,_=self.run_deploy(live='b'*40)
  with self.assertRaisesRegex(RuntimeError,'live'):run()
 def test_previous_success_no_new_release(self):
  run,calls=self.run_deploy(jobs=[{'jobId':'42','commitId':SHA,'status':'SUCCEED'}]);self.assertEqual(run(),'42');self.assertNotIn('start-job',calls)
 def test_autobuild_refuses_competing_trigger(self):
  with self.assertRaisesRegex(RuntimeError,'autobuild'):
   m.deploy(SHA,lambda op,**kw:{'enableAutoBuild':True})
 def test_missing_branch_setting_fails_closed(self):
  with self.assertRaisesRegex(RuntimeError,'autobuild'):
   m.deploy(SHA,lambda op,**kw:{})
 def test_poll_timeout_does_not_start_again(self):
  ticks=iter([0,0,800]);calls=[]
  def aws(op,**kw):
   calls.append(op)
   if op=='get-branch':return {'enableAutoBuild':False}
   if op=='list-jobs':return []
   return {'jobId':'42','commitId':SHA,'status':'RUNNING'}
  with self.assertRaisesRegex(RuntimeError,'deadline'):
   m.deploy(SHA,aws,lambda:SHA,lambda:SHA,lambda _:None,lambda:next(ticks))
  self.assertEqual(calls.count('start-job'),1)
if __name__=='__main__':unittest.main()

class CliTests(unittest.TestCase):
 def test_list_jobs_uses_supported_bounded_pagination(self):
  from unittest.mock import patch
  import subprocess
  with patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],0,'[]','')) as run:
   self.assertEqual(m.aws('list-jobs'),[])
  command=run.call_args.args[0]
  self.assertNotIn('--max-results',command)
  self.assertNotIn('--no-paginate',command)
  self.assertEqual(command[command.index('--page-size')+1],'50')
  self.assertEqual(command[command.index('--max-items')+1],'50')
 def test_error_exposes_only_safe_code(self):
  from unittest.mock import patch
  import subprocess
  error=subprocess.CalledProcessError(254,[],stderr='An error occurred (AccessDeniedException) when calling ListJobs: secret https://signed.invalid/token')
  with patch.object(m.subprocess,'run',side_effect=error):
   with self.assertRaisesRegex(RuntimeError,'AccessDeniedException') as raised:m.aws('list-jobs')
  self.assertNotIn('signed.invalid',str(raised.exception))
  self.assertNotIn('secret',str(raised.exception))

class CreatedJobTests(unittest.TestCase):
 run_deploy = DeployTests.run_deploy
 def test_created_same_commit_resumes(self):
  run,calls=self.run_deploy(jobs=[{'jobId':'42','commitId':SHA,'status':'CREATED'}])
  self.assertEqual(run(),'42');self.assertNotIn('start-job',calls)
 def test_created_other_commit_blocks(self):
  run,calls=self.run_deploy(jobs=[{'jobId':'42','commitId':'b'*40,'status':'CREATED'}])
  with self.assertRaisesRegex(RuntimeError,'another'):run()
  self.assertNotIn('start-job',calls)
