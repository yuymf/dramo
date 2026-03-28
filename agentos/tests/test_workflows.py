from agentos.workflows.storyboard_workflow import StoryboardWorkflow
import pytest
import time
import os

from ..env_loader import load_backend_env

load_backend_env()

input_text = """嗤的一声，战斗室的门打开。
穿着操作服的身影飞快地跑向LULU的控制舱，跳了进去。
运营B：（OS）LULU已就位！
雫LULU的舱门关上，上方屏幕亮起了元气浪人（LULU战斗服装）的图样。
运营A：（OS）开始神经同步！
战备室内，大屏幕上出现三名队员的图形，以及心率血压等体征数据。
运营B将唱片的唱针放好，一首歌曲同时在战备室和战斗室中响起。声场由近及远，再缓缓地由远及近，越来越清晰。
面部特写，控制舱中的七海闭上眼睛。
运营A：听觉同步中。
运营B：好，现在切到内部频道。大家可以听到吗？
星瞳：听觉正常。
七海：（OS）又是这歌儿啊？
LULU（塔菲）：（OS）嗯。
运营A：触觉同步中。
面部特写，控制舱中的星瞳闭着眼睛说话。
星瞳：（OS）触觉正常。
七海双手握住手柄，吃力地拖动了一下。（模仿拎起沉重电锯的动作）
七海：嘿！（一个很萌的气声）
LULU（塔菲）：嗯。
运营A：LULU声音好小啊，把音量调大点吧。
LULU（塔菲）：嗯！
七海：第一次上场，紧张了吧。
星瞳：(OS）海海，还记得你第一次登场吗？
七海：(OS)记得啊。
星瞳：那你记得我第一次登场吗？
七海：啊？（弹簧音）呃…… 
运营A：前庭觉已同步，请确认。    
星瞳：平衡正常！——我是说我第一次登场战斗的时候。
七海：哦……（松弛下来）
星瞳：怎么海海你也不说话了？队友之间得多交流啊！
星瞳：我听说有一个前辈选手，仗着游戏水平高，把战斗当游戏玩儿，跟队友交流差得很……
七海：啊？她也不爱说话吗？
星瞳：（OS）不是，主要这个前辈说话口齿不清，又喜欢怪叫。
七海：（OS）所以LULU要相信自己。你比那个人强多了。  
运营A：视觉已同步。
"""

@pytest.mark.integration
def test_storyboard_workflow():
    """Test workflow with concurrent chunk processing"""
    print("="*60)
    print("Testing Storyboard Workflow with Concurrency")
    print("="*60)
    
    # Get concurrency setting
    concurrency = os.getenv("LLM_CONCURRENCY", "3")
    print(f"\n📊 LLM Concurrency: {concurrency}")
    print(f"📝 Input text length: {len(input_text)} characters")
    
    workflow_input = {
        "projectId": "test-project",
        "text": input_text,
        "chunk_tokens": 1200
    }
    
    print("\n🚀 Starting workflow...\n")
    start_time = time.time()
    
    try:
        workflow = StoryboardWorkflow()
        res = workflow.run(input=workflow_input)
        
        elapsed_time = time.time() - start_time
        
        print("\n" + "="*60)
        print("✅ Workflow completed successfully!")
        print(f"⏱️  Total time: {elapsed_time:.2f} seconds")
        print("="*60)
        
        # Print result preview
        if hasattr(res, 'content'):
            content = res.content
            print(f"\n📄 Result preview:")
            print(f"   Type: {type(content)}")
            if isinstance(content, str):
                print(f"   Length: {len(content)} characters")
                print(f"   Preview: {content[:200]}...")
            else:
                print(f"   Content: {content}")
        else:
            print(f"\n📄 Result: {res}")
            
    except Exception as e:
        elapsed_time = time.time() - start_time
        print("\n" + "="*60)
        print("❌ Workflow failed!")
        print(f"⏱️  Time before failure: {elapsed_time:.2f} seconds")
        print(f"💥 Error: {e}")
        print("="*60)
        raise

if __name__ == "__main__":
    test_storyboard_workflow()