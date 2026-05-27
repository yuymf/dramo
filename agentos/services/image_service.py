"""
Image Generation Service

Unified image generation service using Seedream AI.
Supports multiple generation modes with intelligent routing.
"""

import os
from typing import List, Optional, Dict, Any, Generator
from openai import OpenAI
import logging
import json

try:
    from ..env_loader import load_backend_env
except ImportError:
    from env_loader import load_backend_env

load_backend_env()
logger = logging.getLogger(__name__)


class ImageGenerationService:
    """
    Unified image generation service
    
    Supports 6 generation modes:
    1. text_to_image - 纯文本生成单图
    2. image_to_image - 单图参考生成单图
    3. merge_images - 多图融合生成单图
    4. text_to_sequence - 纯文本生成组图
    5. image_to_sequence - 单图参考生成组图
    6. images_to_sequence - 多图参考生成组图
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://ark.cn-beijing.volces.com/api/v3",
        model: str = "doubao-seedream-4-0-250828",
    ):
        self.model = model
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key or os.environ.get("ARK_API_KEY"),
        )
        logger.info(f"Initialized ImageGenerationService with model: {model}")
    
    def generate(
        self,
        prompt: str,
        reference_images: Optional[List[str]] = None,
        mode: str = 'single',
        stream: bool = False,
        generation_type: Optional[str] = None,
        size: str = "2K",
        watermark: bool = False,
        max_images: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        智能路由图像生成
        
        Args:
            prompt: 生成提示词
            reference_images: 参考图片URL列表
            mode: 'single' 或 'sequence'
            stream: 是否使用流式输出
            generation_type: 明确指定生成类型（可选，优先级最高）
            size: 图片尺寸
            watermark: 是否添加水印
            max_images: sequence模式下最大生成数量
            
        Returns:
            Dict containing images and metadata
        """
        reference_images = reference_images or []
        
        # 决策使用哪种生成方法
        actual_type = self._decide_generation_method(
            reference_images, mode, generation_type
        )
        
        logger.info(
            f"Image generation: type={actual_type}, "
            f"refs={len(reference_images)}, stream={stream}"
        )
        
        # 流式输出
        if stream:
            return self._generate_stream(
                prompt=prompt,
                reference_images=reference_images,
                mode=mode,
                size=size,
                watermark=watermark,
                max_images=max_images
            )
        
        # 非流式输出 - 路由到具体方法
        if actual_type == 'text_to_image':
            url = self._text_to_image(prompt, size, watermark)
            return {
                "success": True,
                "mode": "single",
                "type": "text_to_image",
                "images": [{"url": url}]
            }
        
        elif actual_type == 'image_to_image':
            url = self._image_to_image(
                prompt, reference_images[0], size, watermark
            )
            return {
                "success": True,
                "mode": "single",
                "type": "image_to_image",
                "images": [{"url": url}]
            }
        
        elif actual_type == 'merge_images':
            try:
                logger.info(f"[generate] Calling _merge_images...")
                url = self._merge_images(
                    prompt, reference_images, size, watermark
                )
                logger.info(f"[generate] _merge_images returned URL: {url[:100] if url else 'None'}...")
                
                result = {
                    "success": True,
                    "mode": "single",
                    "type": "merge_images",
                    "images": [{"url": url}]
                }
                logger.info(f"[generate] Returning result: {result}")
                return result
            except Exception as e:
                logger.error(f"[generate] _merge_images failed: {type(e).__name__}: {str(e)}")
                raise
        
        elif actual_type == 'text_to_sequence':
            urls = self._generate_image_sequence(
                prompt, max_images, size, watermark
            )
            return {
                "success": True,
                "mode": "sequence",
                "type": "text_to_sequence",
                "images": [{"url": url} for url in urls]
            }
        
        elif actual_type == 'image_to_sequence':
            urls = self._image_to_sequence(
                prompt, reference_images[0], max_images, size, watermark
            )
            return {
                "success": True,
                "mode": "sequence",
                "type": "image_to_sequence",
                "images": [{"url": url} for url in urls]
            }
        
        elif actual_type == 'images_to_sequence':
            urls = self._images_to_sequence(
                prompt, reference_images, max_images, size, watermark
            )
            return {
                "success": True,
                "mode": "sequence",
                "type": "images_to_sequence",
                "images": [{"url": url} for url in urls]
            }
        
        else:
            raise ValueError(f"Unknown generation type: {actual_type}")
    
    def _decide_generation_method(
        self,
        reference_images: List[str],
        mode: str,
        generation_type: Optional[str] = None
    ) -> str:
        """
        智能决策使用哪个生成函数
        
        优先级：
        1. generation_type (前端明确指定)
        2. 自动判断 (根据 reference_images 数量和 mode)
        """
        if generation_type:
            return generation_type
        
        ref_count = len(reference_images)
        
        if mode == 'sequence':
            if ref_count == 0:
                return 'text_to_sequence'
            elif ref_count == 1:
                return 'image_to_sequence'
            else:
                return 'images_to_sequence'
        else:  # single
            if ref_count == 0:
                return 'text_to_image'
            elif ref_count == 1:
                return 'image_to_image'
            else:
                return 'merge_images'
    
    # ========== 单图生成方法 ==========
    
    def _text_to_image(
        self,
        prompt: str,
        size: str = "2K",
        watermark: bool = False
    ) -> str:
        """纯文本生成单图"""
        logger.info(f"text_to_image: {prompt[:50]}...")
        
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="url",
            extra_body={"watermark": watermark},
        )
        
        return response.data[0].url
    
    def _image_to_image(
        self,
        prompt: str,
        image_url: str,
        size: str = "2K",
        watermark: bool = False
    ) -> str:
        """单图参考生成单图"""
        logger.info(f"image_to_image: {prompt[:50]}...")
        
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="url",
            extra_body={"image": image_url, "watermark": watermark},
        )
        
        return response.data[0].url
    
    def _merge_images(
        self,
        prompt: str,
        image_urls: List[str],
        size: str = "2K",
        watermark: bool = False
    ) -> str:
        """多图融合生成单图"""
        logger.info(f"merge_images: {len(image_urls)} images, {prompt[:50]}...")

        try:
            response = self.client.images.generate(
                model=self.model,
                prompt=prompt,
                size=size,
                response_format="url",
                extra_body={
                    "image": image_urls,
                    "watermark": watermark,
                    "sequential_image_generation": "disabled",
                },
            )

            if not hasattr(response, 'data') or not response.data:
                raise ValueError("API response missing or empty 'data' field")

            return response.data[0].url

        except Exception as e:
            logger.error(
                "merge_images failed",
                exc_info=True,
                extra={"prompt_preview": prompt[:100]},
            )
            raise
    
    # ========== 组图生成方法 ==========
    
    def _generate_image_sequence(
        self,
        prompt: str,
        max_images: int = 4,
        size: str = "2K",
        watermark: bool = False
    ) -> List[str]:
        """纯文本生成组图"""
        logger.info(f"text_to_sequence: {max_images} images, {prompt[:50]}...")
        
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="url",
            extra_body={
                "watermark": watermark,
                "sequential_image_generation": "auto",
                "sequential_image_generation_options": {"max_images": max_images},
            },
        )
        
        return [img.url for img in response.data]
    
    def _image_to_sequence(
        self,
        prompt: str,
        image_url: str,
        max_images: int = 5,
        size: str = "2K",
        watermark: bool = False
    ) -> List[str]:
        """单图参考生成组图"""
        logger.info(f"image_to_sequence: {max_images} images, {prompt[:50]}...")
        
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="url",
            extra_body={
                "image": image_url,
                "watermark": watermark,
                "sequential_image_generation": "auto",
                "sequential_image_generation_options": {"max_images": max_images},
            },
        )
        
        return [img.url for img in response.data]
    
    def _images_to_sequence(
        self,
        prompt: str,
        image_urls: List[str],
        max_images: int = 3,
        size: str = "2K",
        watermark: bool = False
    ) -> List[str]:
        """多图参考生成组图"""
        logger.info(f"images_to_sequence: {max_images} images from {len(image_urls)} refs, {prompt[:50]}...")
        
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="url",
            extra_body={
                "image": image_urls,
                "watermark": watermark,
                "sequential_image_generation": "auto",
                "sequential_image_generation_options": {"max_images": max_images},
            },
        )
        
        return [img.url for img in response.data]
    
    # ========== 流式输出 ==========
    
    def _generate_stream(
        self,
        prompt: str,
        reference_images: Optional[List[str]] = None,
        mode: str = 'single',
        size: str = "2K",
        watermark: bool = False,
        max_images: int = 3
    ) -> Generator[Dict[str, Any], None, None]:
        """
        流式生成图片
        
        Returns:
            Generator yielding SSE events
        """
        logger.info(f"stream generation: {prompt[:50]}...")
        
        extra_body = {
            "watermark": watermark,
        }
        
        # 根据模式设置参数
        if mode == 'sequence':
            extra_body["sequential_image_generation"] = "auto"
            extra_body["sequential_image_generation_options"] = {"max_images": max_images}
        
        # 添加参考图
        if reference_images and len(reference_images) > 0:
            extra_body["image"] = reference_images[0] if len(reference_images) == 1 else reference_images
        
        stream = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            size=size,
            response_format="b64_json",
            stream=True,
            extra_body=extra_body,
        )
        
        for event in stream:
            if event is None:
                continue
            elif event.type == "image_generation.partial_succeeded":
                if event.b64_json is not None:
                    yield {
                        "type": "partial",
                        "data": event.b64_json,
                        "size": len(event.b64_json),
                    }
            elif event.type == "image_generation.completed":
                if event.usage is not None:
                    yield {
                        "type": "completed",
                        "usage": event.usage.__dict__ if hasattr(event.usage, '__dict__') else str(event.usage)
                    }


# Thread-safe singleton with double-checked locking
import threading as _threading

_image_service: 'ImageGenerationService | None' = None
_image_service_lock = _threading.Lock()

def get_image_service() -> 'ImageGenerationService':
    """获取图像生成服务单例（线程安全）"""
    global _image_service
    if _image_service is None:
        with _image_service_lock:
            if _image_service is None:
                _image_service = ImageGenerationService()
    return _image_service

